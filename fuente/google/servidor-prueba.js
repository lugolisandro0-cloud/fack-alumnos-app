const http=require("http");const {crearEntorno}=require("./simulador");
const g=crearEntorno({ahora:new Date()});g.setAhora(new Date());
http.createServer((req,res)=>{let b="";req.on("data",c=>b+=c);req.on("end",()=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.url==="/admin/eventos"){res.end(JSON.stringify(g.activos()));return}
  if(req.url.startsWith("/admin/mover")){const o=JSON.parse(b);g.gcalMover(o.id,o.h,o.hf);res.end("{}");return}
  try{res.end(JSON.stringify(g.post(JSON.parse(b))))}catch(e){res.end(JSON.stringify({ok:false,error:String(e)}))}
})}).listen(8787,()=>console.log("listo"));
