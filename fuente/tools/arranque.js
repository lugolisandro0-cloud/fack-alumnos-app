/* ---------- arranque ---------- */
(function iniciar(){
  try{const r=JSON.parse(localStorage.getItem(LS)||"null");if(r){alumnos=r.alumnos||[];pagos=r.pagos||{};gastos=r.gastos||[];liquidaciones=r.liquidaciones||[];config=r.config||{}}}catch(e){}
  loaded=true;render();
  try{actualizacion.arranqueOk()}catch(e){}
  setTimeout(()=>actualizacion.revisar(false),4000);
  setInterval(()=>{if(document.visibilityState==="visible")actualizacion.revisar(false)},6*3600*1000);
  // sincronización: al abrir, al volver a la app y cada minuto mientras está abierta (no hace nada sin sesión)
  setInterval(()=>{if(document.visibilityState==="visible")sync.ciclo()},30000);
  addEventListener("focus",()=>sync.ciclo());
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){sync.ciclo();safeRender()}});
  addEventListener("online",()=>sync.ciclo());
  // al cambiar de día con la app abierta
  let dia=iso(today());setInterval(()=>{const d=iso(today());if(d!==dia){dia=d;agendarAvisos();safeRender()}},60000);
  if(!sync.activo()){pantallaAcceso();return}
  const L=LN();
  if(L)L.checkPermissions().then(p=>{permisoAvisos=p.display;if(p.display==="granted"&&avisosOn)agendarAvisosYa();safeRender()}).catch(()=>{});
  sync.ciclo();
})();
