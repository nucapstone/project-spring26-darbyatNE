// See https://observablehq.com/framework/config
// Observable Framework configuration

export default {
  root: "src",
  title: "PJM LMP Visualization",
  pager: false, 
  head: `
        <link rel="icon" href="/img/lmp_icon.png" type="image/png">
        <meta property="og:image" content="/img/observable.png">
        `,
        
  // Sidebar Page Titles
  pages: [
    {
      name: "Build A Filter", 
      path: "/picker"
    }
  ],

  // API requests to backend proxy
  proxy: {
    "/api": {
      target: process.env.BACKEND_URL || "http://127.0.0.1:8000",
      changeOrigin: true
    }
  }
};
