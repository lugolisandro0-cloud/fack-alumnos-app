/* Actualizaciones: si hay una versión descargada más nueva que la instalada, se usa esa. */
(function(){
  var V="__VERSION__";window.APP_VERSION=V;window.APP_BASE=window.APP_BASE||V;
  function cmp(a,b){a=String(a).split(".").map(Number);b=String(b).split(".").map(Number);for(var i=0;i<3;i++){var d=(a[i]||0)-(b[i]||0);if(d)return d>0?1:-1}return 0}
  window.cmpVersion=cmp;
  if(window.__fackSwap)return;
  try{
    if(localStorage.getItem("fack-update-off")==="1")return;
    var u=JSON.parse(localStorage.getItem("fack-update")||"null");
    if(!u||!u.html||cmp(u.v,V)<=0)return;
    if(u.base&&cmp(window.APP_BASE,u.base)<0)return;
    // Si la versión descargada no llegó a arrancar la vez anterior, se descarta.
    var p=localStorage.getItem("fack-update-arranque");
    if(p===u.v){localStorage.removeItem("fack-update");localStorage.removeItem("fack-update-arranque");localStorage.setItem("fack-update-mala",u.v);return}
    localStorage.setItem("fack-update-arranque",u.v);
    window.__fackSwap=1;
    document.write('<plaintext style="display:none">');
    var cambiar=function(){document.open();document.write(u.html);document.close()};
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(cambiar,0)});else setTimeout(cambiar,0);
  }catch(e){}
})();
