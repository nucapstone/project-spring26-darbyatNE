import os
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
import collections
from pydantic import BaseModel
from typing import Optional, List

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

# --- API Endpoints ---

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
        print(f"Server Error in get_zones: {e}")
        # Return empty to avoid crashing frontend
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

        # Constraints Query (Unchanged, assuming schema is correct)
        constraints_query_str = """
            SELECT
                TO_CHAR(datetime_beginning_ept, 'YYYY-MM-DD HH24:00:00') AS hour_beginning,
                monitored_facility,
                ROUND(SUM(shadow_price) / 12, 2) AS shadow_price
            FROM
                public.pjm_binding_constraints
            WHERE
                datetime_beginning_ept >= :start_dt AND datetime_beginning_ept < :end_dt
                AND EXTRACT(HOUR FROM datetime_beginning_ept) >= :start_hour
                AND EXTRACT(HOUR FROM datetime_beginning_ept) < :end_hour
        """

        # Day of Week Filter
        if query.days_of_week:
            dow_clause_da = " AND (EXTRACT(DOW FROM da.datetime_beginning_ept) + 1) IN :days_of_week"
            dow_clause_con = " AND (EXTRACT(DOW FROM datetime_beginning_ept) + 1) IN :days_of_week"
            
            lmp_query_str += dow_clause_da
            constraints_query_str += dow_clause_con
            
            params["days_of_week"] = tuple(query.days_of_week)

        # Selected Constraint Filter
        if query.monitored_facility:
            subquery = """
                SELECT DISTINCT TO_CHAR(datetime_beginning_ept, 'YYYY-MM-DD HH24:00:00')
                FROM public.pjm_binding_constraints
                WHERE monitored_facility = :monitored_facility
            """
            # Note: Subquery filtering might be slow on large datasets, but keeping logic for now
            lmp_query_str += f" AND TO_CHAR(da.datetime_beginning_ept, 'YYYY-MM-DD HH24:00:00') IN ({subquery})"
            constraints_query_str += f" AND TO_CHAR(datetime_beginning_ept, 'YYYY-MM-DD HH24:00:00') IN ({subquery})"
            params["monitored_facility"] = query.monitored_facility
            
        # Final Group By and Order
        lmp_query_str += ' GROUP BY ll.transact_z, da.datetime_beginning_ept ORDER BY ll.transact_z, da.datetime_beginning_ept;'
        constraints_query_str += " GROUP BY hour_beginning, monitored_facility ORDER BY hour_beginning, monitored_facility;"
        
        lmp_result = db.execute(text(lmp_query_str), params)
        
        # Try/Except for constraints in case that table is missing
        try:
            constraints_result = db.execute(text(constraints_query_str), params)
            constraint_rows = constraints_result.fetchall()
        except Exception as e:
            print(f"Warning: Constraints table issue: {e}")
            constraint_rows = []

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

        # Constraints Data Processing
        constraints_data = []
        for row in constraint_rows:
            row_dict = row._asdict()
            constraints_data.append({
                "name": row_dict['monitored_facility'],
                "timestamp": str(row_dict['hour_beginning']), 
                "shadow_price": float(row_dict['shadow_price']) if row_dict['shadow_price'] else 0.0
            })

        return {
            "zones": lmp_data_by_zone,
            "constraints": constraints_data
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Please use YYYY-MM-DD.")
    except Exception as e:
        print(f"Server Error in get_lmp_data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/nodes")
async def get_pjm_nodes():
    """
    Fetches all PJM Nodes with location data.
    Used for mapping individual LMPs to physical coordinates.
    """
    try:
        # Assuming you are using a similar DB connection pattern as your other endpoints
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                query = """
                    SELECT pnode_id, alt_name, latitude, longitude 
                    FROM pjm_lat_long 
                    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                """
                cur.execute(query)
                rows = cur.fetchall()
                
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
        print(f"Error fetching nodes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/constraints/list")
def get_unique_constraints(db: Session = Depends(get_db)):
    try:
        query = text("""
            SELECT DISTINCT monitored_facility 
            FROM public.pjm_binding_constraints
            WHERE monitored_facility IS NOT NULL
            ORDER BY monitored_facility ASC
        """)
        
        result = db.execute(query)
        constraints = [row[0] for row in result.fetchall()]
        return {"constraints": constraints}
        
    except Exception as e:
        print(f"Server Error in constraints list: {e}")
        # Return empty list instead of crashing
        return {"constraints": []}