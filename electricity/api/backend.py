import os
import json
import csv
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from typing import Optional, List, Any
import ast
import collections

load_dotenv()
app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class LmpRangeQuery(BaseModel):
    start_day: str
    end_day: str
    days_of_week: Optional[List[int]] = None
    start_hour: Optional[int] = None
    end_hour: Optional[int] = None
    monitored_facility: Optional[str] = None

class UtilityDataRequest(BaseModel):
    startYear: int
    endYear: int
    months: List[int]

# --- API Endpoints ---

@app.get("/api/service-terr")
def get_service_territories(db: Session = Depends(get_db)):
    try:
        # PATH TO CSV
        base_dir = os.path.dirname(os.path.abspath(__file__))
        csv_path = os.path.join(base_dir, "..", "src", "hydrate", "retail", "utility_names.csv")
        
        if not os.path.exists(csv_path):
            return {"type": "FeatureCollection", "features": []}

        target_names = []
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                territory_name = row.get("TERRITORIES_TO_MAP")
                iso_rto_value = row.get("ISO/RTO")
                if iso_rto_value == "PJM" and territory_name and territory_name.strip():
                    target_names.append(territory_name.strip())

        if not target_names:
            return {"type": "FeatureCollection", "features": []}

        query = text("""
            SELECT 
                name, 
                id,
                ST_AsGeoJSON(wkb_geometry) as geometry_geojson
            FROM service_territories
            WHERE name = ANY(:names)
        """)
        
        result = db.execute(query, {"names": target_names})
        
        features = []
        for row in result.fetchall():
            row_dict = row._asdict()
            geometry = json.loads(row_dict['geometry_geojson'])
            feature = {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "name": row_dict['name'],
                    "id": row_dict['id']
                }
            }
            features.append(feature)

        return {
            "type": "FeatureCollection", 
            "features": features
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/zones")
def get_zones(db: Session = Depends(get_db)):
    try:
        shape_query = text("""
            SELECT 
                zone_name, 
                transact_z, 
                ST_AsGeoJSON(ST_GeomFromText(wkt)) as geometry_geojson
            FROM pjm_zone_shapes
            WHERE wkt IS NOT NULL
        """)
        
        shape_result = db.execute(shape_query)
        features = []
        
        for zone_shape_row in shape_result.fetchall():
            row_dict = zone_shape_row._asdict()
            geometry = json.loads(row_dict['geometry_geojson']) 
            feature = {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "zone_name": row_dict['zone_name'], 
                    "transact_z": row_dict['transact_z']    
                }
            }
            features.append(feature)
            
        if not features:
            return {"type": "FeatureCollection", "features": []}    
        return {"type": "FeatureCollection", "features": features}
        
    except Exception as e:
        return {"type": "FeatureCollection", "features": []}

@app.post("/api/lmp/range")
def get_lmp_data_for_range(query: LmpRangeQuery, db: Session = Depends(get_db)):
    try:
        params = {}
        start_datetime_obj = datetime.strptime(query.start_day, '%Y-%m-%d')
        end_datetime_obj = datetime.strptime(query.end_day, '%Y-%m-%d') + timedelta(days=1)
        params["start_dt"] = start_datetime_obj
        params["end_dt"] = end_datetime_obj
        params["start_hour"] = query.start_hour
        params["end_hour"] = query.end_hour

        lmp_query_str = """
            SELECT
                ll.transact_z,
                da.datetime_beginning_ept,
                AVG(da.total_lmp_da) AS lmp_da,
                AVG(rt.total_lmp_rt) AS lmp_rt,
                AVG(rt.total_lmp_rt - da.total_lmp_da) AS lmp_net
            FROM
                pjm_da_hrl_lmps AS da
            JOIN
                pjm_rt_hrl_lmps AS rt ON da.pnode_id = rt.pnode_id AND da.datetime_beginning_ept = rt.datetime_beginning_ept
            JOIN
                pjm_lat_long AS ll ON da.pnode_id = ll.pnode_id
            WHERE
                da.datetime_beginning_ept >= :start_dt AND da.datetime_beginning_ept < :end_dt
                AND EXTRACT(HOUR FROM da.datetime_beginning_ept) >= :start_hour
                AND EXTRACT(HOUR FROM da.datetime_beginning_ept) < :end_hour
        """

        # Day of Week Filter
        if query.days_of_week:
            dow_clause_da = " AND (EXTRACT(DOW FROM da.datetime_beginning_ept) + 1) IN :days_of_week"
            lmp_query_str += dow_clause_da
            params["days_of_week"] = tuple(query.days_of_week)

        # Final Group By and Order
        lmp_query_str += ' GROUP BY ll.transact_z, da.datetime_beginning_ept ORDER BY ll.transact_z, da.datetime_beginning_ept;'
        
        lmp_result = db.execute(text(lmp_query_str), params)

        # LMP Data Processing
        lmp_data_by_zone = collections.defaultdict(list)
        lmp_rows = lmp_result.fetchall()
        
        if lmp_rows:
            for row in lmp_rows:
                row_dict = row._asdict()
                lmp_data_by_zone[row_dict['transact_z']].append({
                    "datetime_beginning_ept": row_dict['datetime_beginning_ept'].isoformat(),
                    "lmp_values": {
                        "da": float(row_dict['lmp_da']) if row_dict['lmp_da'] else 0.0,
                        "rt": float(row_dict['lmp_rt']) if row_dict['lmp_rt'] else 0.0,
                        "net": float(row_dict['lmp_net']) if row_dict['lmp_net'] else 0.0
                    }
                })

        return {
            "zones": lmp_data_by_zone,
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Please use YYYY-MM-DD.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nodes")
async def get_pjm_nodes(db: Session = Depends(get_db)):
    """
    Fetches all PJM Nodes with location data.
    Used for mapping individual LMPs to physical coordinates.
    """
    try:
        query = """
            SELECT pnode_id, alt_name, latitude, longitude 
            FROM pjm_lat_long 
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        """
        result = db.execute(text(query))
        rows = result.fetchall()
        
        # Convert to list of dicts
        nodes = [
            {
                "pnode_id": row[0],
                "name": row[1],
                "lat": float(row[2]),
                "lon": float(row[3])
            } 
            for row in rows
        ]
        
        return {"nodes": nodes, "count": len(nodes)}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional

# Assuming @app and get_db are defined elsewhere in your file
@app.get("/api/service_territory_price_data")
def get_service_territory_price_data(
    startYear: int = Query(..., ge=2000, le=2100),
    endYear: int = Query(..., ge=2000, le=2100),
    months: Optional[str] = Query(None, description="Comma-separated months, 1-12"),
    db: Session = Depends(get_db)
):
    if startYear > endYear:
        raise HTTPException(status_code=400, detail="startYear must be less than or equal to endYear")

    month_list = None
    if months:
        try:
            month_list = [int(m.strip()) for m in months.split(',') if m.strip()]
            if any(m < 1 or m > 12 for m in month_list):
                raise ValueError
        except ValueError:
            raise HTTPException(status_code=400, detail="months must be comma-separated integers between 1 and 12")

    try:
        # 1. Build the dynamic SQL query using the FULL OUTER JOIN logic
        base_query = """
            SELECT 
                COALESCE(r.utility, w.service_territory) AS service_territory,
                COALESCE(r.year, w.year) AS year,
                COALESCE(r.month, w.month) AS month,
                r.total AS retail_price,
                w.ws_price/1000 AS wholesale_price
            FROM public.retail_monthly_rates_pjm r
            FULL OUTER JOIN wholesale_month_price w
                ON r.utility = w.service_territory
                AND r.year = w.year
                AND r.month = w.month
            WHERE COALESCE(r.year, w.year) >= :start_year 
              AND COALESCE(r.year, w.year) <= :end_year
              AND COALESCE(r.utility, w.service_territory) IN (
                  SELECT DISTINCT service_territory 
                  FROM wholesale_month_price
              )
        """
        
        params = {"start_year": startYear, "end_year": endYear}

        # 2. Append the month filter if provided
        if month_list:
            base_query += " AND COALESCE(r.month, w.month) IN :months"
            params["months"] = tuple(month_list)

        # 3. Add the sorting logic directly to the SQL
        base_query += " ORDER BY service_territory, year, month;"

        # 4. Execute the unified query
        result = db.execute(text(base_query), params).fetchall()

        # 5. Format the data for the JSON response
        data = []
        for row in result:
            # Handle SQLAlchemy row mapping (compatible with SQLAlchemy 1.4 and 2.0)
            row_dict = dict(row._mapping) if hasattr(row, '_mapping') else row._asdict()
            
            data.append({
                "service_territory": row_dict["service_territory"],
                "year": int(row_dict["year"]),
                "month": int(row_dict["month"]),
                "retail_price": float(row_dict["retail_price"]) if row_dict["retail_price"] is not None else None,
                "wholesale_price": float(row_dict["wholesale_price"]) if row_dict["wholesale_price"] is not None else None
            })

        return {
            "data": data, 
            "count": len(data), 
            "params": {
                "startYear": startYear, 
                "endYear": endYear, 
                "months": month_list
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/utility_data/range")
def get_utility_data_for_range(
    startYear: int = Query(..., ge=2020, le=2026),
    endYear: int = Query(..., ge=2020, le=2026),
    month: str = Query(...),  # Accepting month as a string
    db: Session = Depends(get_db)
):
    # Convert the month string to a list of integers
    try:
        month_list = ast.literal_eval(month)  # Safely evaluate the string to a list
    except (ValueError, SyntaxError):
        raise HTTPException(status_code=400, detail="Invalid month format. Use format: [1, 2, 4].")

    # Validate months
    if any(m < 1 or m > 12 for m in month_list):
        raise HTTPException(status_code=400, detail="Months must be between 1 (January) and 12 (December).")

    if startYear > endYear:
        raise HTTPException(status_code=400, detail="Start year must be less than or equal to end year.")

    try:
        # Base query
        query_str = """
            SELECT
                utility,
                total,
                generation,
                transmission,
                distribution,
                other
            FROM retail_pjm
            WHERE year >= :start_year AND year <= :end_year
        """

        # Build month conditions
        if month_list:
            month_conditions = " OR ".join([f"month = {m}" for m in month_list])
            query_str += f" AND ({month_conditions})"

        # Prepare the final query
        query = text(query_str)

        # Execute the query
        results = db.execute(query, {
            "start_year": startYear,
            "end_year": endYear
        }).fetchall()

        data = [
            {
                "utility": row.utility,
                "total": row.total,
                "generation": row.generation,
                "transmission": row.transmission,
                "distribution": row.distribution,
                "other": row.other,
            }
            for row in results
        ]

        return {"data": data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/retail_lmps")
def get_retail_lmps_data(
    db: Session = Depends(get_db)
):
    try:
        # 1. Base Query: Select ALL columns with no filters
        sql = "SELECT * FROM retail_lmps"
        params = {}
        
        # 2. Execute
        result = db.execute(text(sql), params)
        
        # 3. Convert to List of Dictionaries (Dynamic columns)
        data = [row._asdict() for row in result.fetchall()]
        
        return {"data": data, "count": len(data)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
