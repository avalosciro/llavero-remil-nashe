/* ============================================================
   LLAVERO — app.js
   ============================================================ */

const BACKEND = window.location.origin;
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHAR_UUID    = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

/* ---------- Estado ---------- */
let vista = "notas";          // notas | listas | nota | lista | habitos
let notas = [];
let listas = [];
let habitos = [];
let idAbierto = null;
let filtro = "";
let ultimaGratitude = null;

/* ---------- Atajos ---------- */
const $ = id => document.getElementById(id);

/* ============================================================
   ALMACENAMIENTO
   ============================================================ */
function cargar(){
  try{ notas  = JSON.parse(localStorage.getItem("llavero_notas")  || "[]"); }catch{ notas  = []; }
  try{ listas = JSON.parse(localStorage.getItem("llavero_listas") || "[]"); }catch{ listas  = []; }
  try{ habitos = JSON.parse(localStorage.getItem("llavero_habitos") || "[]"); }catch{ habitos = []; }
  const hoyKey = "llavero_gratitude_" + new Date().toISOString().slice(0,10);
  try{ ultimaGratitude = JSON.parse(localStorage.getItem(hoyKey) || "null"); }catch{ ultimaGratitude = null; }
  if (!ultimaGratitude) ultimaGratitude = { texto:"", fecha:new Date().toISOString().slice(0,10) };
}
function guardar(){
  try{
    localStorage.setItem("llavero_notas",  JSON.stringify(notas));
    localStorage.setItem("llavero_listas", JSON.stringify(listas));
  }catch(e){ avisar("No se pudo guardar en este navegador", "error"); }
}
function guardarHabitos(){
  try{ localStorage.setItem("llavero_habitos", JSON.stringify(habitos)); }catch(e){ avisar("No se pudo guardar en este navegador", "error"); }
}
function guardarGratitude(texto){
  const hoyKey = "llavero_gratitude_" + new Date().toISOString().slice(0,10);
  localStorage.setItem(hoyKey, JSON.stringify({ texto, fecha:new Date().toISOString().slice(0,10) }));
}
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

const COLORES = ["#9FE8C8","#C0AEF0","#FFB59C","#FFDD8F","#A6D8F7"];
const colorPara = id => COLORES[[...id].reduce((a,c)=>a+c.charCodeAt(0),0) % COLORES.length];

function fecha(ts){
  const d = new Date(ts);
  return d.toLocaleDateString("es-AR", { day:"2-digit", month:"short" });
}
const sinHtml = html => { const t = document.createElement("div"); t.innerHTML = html; return t.textContent || ""; };

/* ============================================================
   AVISOS
   ============================================================ */
let timerAviso;
function avisar(texto, tipo = "", ms = 2600){
  const el = $("aviso");
  el.textContent = texto;
  el.className = "aviso mostrar " + tipo;
  clearTimeout(timerAviso);
  if (ms) timerAviso = setTimeout(() => el.className = "aviso " + tipo, ms);
}
const cerrarAviso = () => { clearTimeout(timerAviso); $("aviso").className = "aviso"; };

/* ============================================================
   NAVEGACIÓN
   ============================================================ */
function ir(destino){
  vista = destino;
  document.querySelectorAll(".vista").forEach(v => v.classList.remove("activa"));

  const mapa = { notas:"vistaNotas", listas:"vistaListas", nota:"vistaNota", lista:"vistaLista", habitos:"vistaHabitos", habito:"vistaHabito" };
  $(mapa[destino]).classList.add("activa");

  const enIndice = destino === "notas" || destino === "listas" || destino === "habitos";
  $("btnNuevo").classList.toggle("oculto", !enIndice);
  $("buscador").parentElement.style.display = enIndice ? "flex" : "none";

  $("navNotas").classList.toggle("activo",  destino === "notas");
  $("navListas").classList.toggle("activo", destino === "listas");
  $("navHabitos").classList.toggle("activo", destino === "habitos");

  const titulos = { notas:"Notas", listas:"Listas", nota:"Editar nota", lista:"Editar lista", habitos:"Hábitos", habito:"Editar hábito" };
  $("migas").textContent = titulos[destino];

  window.scrollTo(0,0);
  if (destino === "notas")  pintarNotas();
  if (destino === "listas") pintarListas();
  if (destino === "habitos") pintarHabitos();
  if (destino === "habito") pintarHistorial();
  if (destino === "habitos") pintarGratitude();
}

/* ============================================================
   ÍNDICE DE NOTAS
   ============================================================ */
function pintarNotas(){
  const grid = $("gridNotas");
  grid.innerHTML = "";

  const visibles = notas
    .filter(n => (n.titulo + " " + sinHtml(n.cuerpo)).toLowerCase().includes(filtro))
    .sort((a,b) => b.editado - a.editado);

  $("vacioNotas").classList.toggle("mostrar", visibles.length === 0);

  visibles.forEach(n => {
    const t = document.createElement("button");
    t.className = "tarjeta";
    t.style.background = colorPara(n.id);
    t.innerHTML = `
      <h3></h3>
      <p></p>
      <span class="pie">${fecha(n.editado)}</span>`;
    t.querySelector("h3").textContent = n.titulo || "Sin título";
    t.querySelector("p").textContent  = sinHtml(n.cuerpo).slice(0,140);
    t.onclick = () => abrirNota(n.id);
    grid.appendChild(t);
  });
}

/* ============================================================
   ÍNDICE DE LISTAS
   ============================================================ */
function pintarListas(){
  const grid = $("gridListas");
  grid.innerHTML = "";

  const visibles = listas
    .filter(l => (l.titulo + " " + l.items.map(i => i.texto).join(" ")).toLowerCase().includes(filtro))
    .sort((a,b) => b.editado - a.editado);

  $("vacioListas").classList.toggle("mostrar", visibles.length === 0);

  visibles.forEach(l => {
    const hechos = l.items.filter(i => i.hecho).length;
    const t = document.createElement("button");
    t.className = "tarjeta";
    t.style.background = colorPara(l.id);
    t.innerHTML = `
      <h3></h3>
      <p></p>
      <span class="pie">${hechos}/${l.items.length} · ${fecha(l.editado)}</span>`;
    t.querySelector("h3").textContent = l.titulo || "Sin título";
    t.querySelector("p").textContent  = l.items.slice(0,3).map(i => "• " + i.texto).join("\n") || "Lista vacía";
    t.onclick = () => abrirLista(l.id);
    grid.appendChild(t);
  });
}

/* ============================================================
   EDITOR DE NOTA
   ============================================================ */
function abrirNota(id){
  const n = notas.find(x => x.id === id);
  if (!n) return;
  idAbierto = id;
  $("tituloNota").value      = n.titulo;
  $("cuerpoNota").innerHTML  = n.cuerpo;
  ir("nota");
}

function crearNota(){
  const n = { id:nuevoId(), titulo:"", cuerpo:"", editado:Date.now() };
  notas.push(n);
  guardar();
  abrirNota(n.id);
  $("tituloNota").focus();
}

function guardarNota(){
  const n = notas.find(x => x.id === idAbierto);
  if (!n) return;
  n.titulo  = $("tituloNota").value;
  n.cuerpo  = $("cuerpoNota").innerHTML;
  n.editado = Date.now();
  guardar();
}

/* ============================================================
   EDITOR DE LISTA
   ============================================================ */
function abrirLista(id){
  const l = listas.find(x => x.id === id);
  if (!l) return;
  idAbierto = id;
  $("tituloLista").value = l.titulo;
  pintarItems();
  ir("lista");
}

function crearLista(){
  const l = { id:nuevoId(), titulo:"", items:[], editado:Date.now() };
  listas.push(l);
  guardar();
  abrirLista(l.id);
  $("tituloLista").focus();
}

function guardarLista(){
  const l = listas.find(x => x.id === idAbierto);
  if (!l) return;
  l.titulo  = $("tituloLista").value;
  l.editado = Date.now();
  guardar();
}

function pintarItems(){
  const l = listas.find(x => x.id === idAbierto);
  if (!l) return;
  const ul = $("itemsLista");
  ul.innerHTML = "";

  l.items.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "item" + (item.hecho ? " hecho" : "");
    li.innerHTML = `
      <button class="caja">${item.hecho ? "✕" : ""}</button>
      <span class="txt"></span>
      <button class="quitar">−</button>`;
    li.querySelector(".txt").textContent = item.texto;
    li.querySelector(".caja").onclick   = () => { item.hecho = !item.hecho; guardarLista(); pintarItems(); };
    li.querySelector(".quitar").onclick = () => { l.items.splice(i,1);      guardarLista(); pintarItems(); };
    ul.appendChild(li);
  });
}

function agregarItem(texto){
  const t = (texto || "").trim();
  if (!t) return;
  const l = listas.find(x => x.id === idAbierto);
  if (!l) return;
  l.items.push({ texto:t, hecho:false });
  guardarLista();
  pintarItems();
}

/* ============================================================
   HÁBITOS + GRATITUD
   ============================================================ */
function pintarHabitos(){
  const grid = $("gridHabitos");
  grid.innerHTML = "";
  const visibles = habitos.filter(h => h.activo !== false);
  $("vacioHabitos").classList.toggle("mostrar", visibles.length === 0);

  visibles.forEach(h => {
    const card = document.createElement("button");
    card.className = "tarjeta";
    card.style.background = colorPara(h.id);
    card.innerHTML = `
      <h3></h3>
      <p></p>
      <span class="pie">${fecha(h.editado)}</span>`;
    card.querySelector("h3").textContent = h.titulo || "Sin título";
    const completados = h.dias.filter(d => d.hecho).length;
    const progreso = h.dias.length ? completados / h.dias.length * 100 : 0;
    card.querySelector("p").innerHTML = `
      <div style="height:6px;background:#211F2D;border-radius:3px;overflow:hidden;margin:4px 0">
        <div style="height:100%;width:${progreso}%;background:var(--menta);transition:width 0.3s"></div>
      </div>
      <span style="font-size:11px;opacity:0.7">${completados}/${h.dias.length} días</span>`;
    card.onclick = () => editarHabito(h.id);
    grid.appendChild(card);
  });
}

function editarHabito(id){
  const h = habitos.find(x => x.id === id);
  if (!h) return;
  idAbierto = id;
  $("tituloHabito").value = h.titulo;
  ir("habito");
}

function crearHabito(){
  const h = { id:nuevoId(), titulo:"", dias:[], activo:true, editado:Date.now() };
  habitos.push(h);
  guardarHabitos();
  editarHabito(h.id);
  $("tituloHabito").focus();
}

function guardarHabito(){
  const h = habitos.find(x => x.id === idAbierto);
  if (!h) return;
  h.titulo = $("tituloHabito").value;
  h.editado = Date.now();
  guardar();
  guardarHabitos();
}

function marcarDiaHabito(fechaStr, hecho){
  if (!idAbierto) return;
  const h = habitos.find(x => x.id === idAbierto);
  if (!h) return;
  let dia = h.dias.find(d => d.fecha === fechaStr);
  if (!dia) { dia = { fecha:fechaStr, hecho:false }; h.dias.push(dia); }
  dia.hecho = hecho;
  guardarHabitos();
  pintarHabitos();
}

function eliminarHabito(){
  if (!confirm("¿Eliminar este hábito?")) return;
  habitos = habitos.filter(h => h.id !== idAbierto);
  guardarHabitos();
  ir("habitos");
}

function pintarHistorial(){
  const container = $("#historialHabito");
  container.innerHTML = "";
  if (!idAbierto) return;
  const h = habitos.find(x => x.id === idAbierto);
  if (!h || !h.dias.length) {
    container.innerHTML = `<p class="mini">Sin registros aún. Tocá los círculos para marcar.</p>`;
    return;
  }
  h.dias.forEach(d => {
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.gap = "8px";
    div.style.margin = "4px 0";
    div.innerHTML = `
      <span style="width:20px;font-size:12px;color:var(--texto-tenue)">${d.fecha.slice(-5)}</span>
      <div style="
        width:16px;height:16px;border:2px solid var(--negro);
        border-radius:4px;background:${d.hecho ? 'var(--menta)' : 'var(--superficie2)'};
        flex-shrink:0;cursor:pointer;"
        onclick="marcarDiaHabito('${d.fecha}', !${d.hecho})">
      </div>`;
    container.appendChild(div);
  });
}

function pintarGratitude(){
  $("#gratitud").value = ultimaGratitude ? ultimaGratitude.texto : "";
}
function guardarGratitude(){
  const texto = $("#gratitud").value.trim();
  ultimaGratitude = { texto, fecha:new Date().toISOString().slice(0,10) };
  localStorage.setItem("llavero_gratitude_" + ultimaGratitude.fecha, JSON.stringify(ultimaGratitude));
}

/* ============================================================
   GRABACIÓN DE AUDIO
   ============================================================ */
let grabadora = null;
let trozos = [];
let grabando = false;
let alTerminar = null;

async function alternarGrabacion(boton, callback){
  if (grabando){
    grabadora.stop();
    grabadora.stream.getTracks().forEach(t => t.stop());
    grabando = false;
    boton.classList.remove("grabando");
    return;
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    trozos = [];
    alTerminar = callback;
    grabadora = new MediaRecorder(stream);
    grabadora.ondataavailable = e => trozos.push(e.data);
    grabadora.onstop = () => {
      const blob = new Blob(trozos, { type:"audio/mp4" });
      if (alTerminar) alTerminar(blob);
    };
    grabadora.start();
    grabando = true;
    boton.classList.add("grabando");
    avisar("Grabando. Tocá de nuevo para terminar.", "trabajando", 0);
  }catch(e){
    avisar("No se pudo acceder al micrófono", "error");
  }
}

/* ---------- Grabar y agendar en el calendario ---------- */
async function agendarAudio(blob){
  avisar("Agendando…", "trabajando", 0);
  const fd = new FormData();
  fd.append("audio", blob, "audio.mp4");
  try{
    const res  = await fetch(`${BACKEND}/audio`, { method:"POST", body:fd });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "El servidor no pudo procesarlo");
    avisar("Agendado: " + data.evento);
  }catch(e){
    avisar("No se pudo agendar. Probá de nuevo.", "error");
  }
}

/* ---------- Transcribir para notas y listas ---------- */
async function transcribir(blob){
  const fd = new FormData();
  fd.append("audio", blob, "audio.mp4");
  const res  = await fetch(`${BACKEND}/transcribir`, { method:"POST", body:fd });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Falló la transcripción");
  return (data.texto || "").trim();
}

/* ============================================================
   SINCRONIZAR CON EL LLAVERO (BLE)
   ============================================================ */
async function sincronizar(){
  if (!navigator.bluetooth){
    avisar("Este navegador no soporta Bluetooth. Usá Chrome en Android.", "error", 4000);
    return;
  }
  const btn = $("btnSync");
  try{
    avisar("Buscando el llavero…", "trabajando", 0);
    const device = await navigator.bluetooth.requestDevice({
      filters:[{ namePrefix:"Llavero" }],
      optionalServices:[SERVICE_UUID]
    });
    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const car     = await service.getCharacteristic(CHAR_UUID);

    btn.classList.add("girando");
    avisar("Buscando los eventos de hoy…", "trabajando", 0);

    const res  = await fetch(`${BACKEND}/eventos`);
    const data = await res.json();
    const evs  = data.eventos || [];

    const mensaje = evs.length
      ? evs.map(e => `${e.hora} ${e.titulo}`).join("|") + "|"
      : "Sin eventos hoy";

    const bytes = new TextEncoder().encode(mensaje);
    for (let i = 0; i < bytes.length; i += 20){
      await car.writeValue(bytes.slice(i, i + 20));
      await new Promise(r => setTimeout(r, 50));
    }

    btn.classList.remove("girando");
    avisar(evs.length ? `Llavero al día · ${evs.length} evento(s)` : "Llavero al día · sin eventos hoy");
  }catch(e){
    btn.classList.remove("girando");
    if (e.name === "NotFoundError") cerrarAviso();
    else avisar("No se pudo sincronizar el llavero", "error");
  }
}

/* ============================================================
   EVENTOS DE LA INTERFAZ
   ============================================================ */

/* --- Navegación --- */
$("navNotas").onclick  = () => { filtro = ""; $("buscador").value = ""; ir("notas"); };
$("navListas").onclick = () => { filtro = ""; $("buscador").value = ""; ir("listas"); };

$("btnNuevo").onclick = () => vista === "notas" ? crearNota() : crearLista();

$("buscador").oninput = e => {
  filtro = e.target.value.trim().toLowerCase();
  vista === "notas" ? pintarNotas() : pintarListas();
};

/* --- Botón central: grabar y agendar --- */
$("btnGrabar").onclick = () => alternarGrabacion($("btnGrabar"), agendarAudio);

/* --- Sync --- */
$("btnSync").onclick = sincronizar;

/* --- Cambiar tema --- */
$("btnTema").onclick = alternarTema;

/* --- Navegación de hábitos --- */
$("navHabitos").onclick = () => { filtro = ""; ir("habitos"); };
$("nuevoHabito").onclick = crearHabito;

$("btnNuevo").onclick = () => {
  if (vista === "notas") crearNota();
  else if (vista === "listas") crearLista();
  else if (vista === "habitos") crearHabito();
  else if (vista === "habito") guardarHabito();
};

/* --- Editor de hábito --- */
$("tituloHabito").oninput = guardarHabito;
$("eliminarHabito").onclick = eliminarHabito;

/* --- Gratitud --- */
$("#gratitud").onblur = guardarGratitude;

/* --- Editor de nota --- */
$("tituloNota").oninput     = guardarNota;
$("cuerpoNota").oninput     = guardarNota;

document.querySelectorAll(".tb[data-cmd]").forEach(b => {
  b.onmousedown = e => e.preventDefault();
  b.onclick = () => { document.execCommand(b.dataset.cmd, false, null); guardarNota(); };
});
$("selTamano").onchange = e => { document.execCommand("fontSize", false, e.target.value); guardarNota(); };
$("selFuente").onchange = e => { document.execCommand("fontName", false, e.target.value); guardarNota(); };
document.querySelectorAll(".sw").forEach(b => {
  b.onmousedown = e => e.preventDefault();
  b.onclick = () => { document.execCommand("foreColor", false, b.dataset.color); guardarNota(); };
});

$("micNota").onclick = () => alternarGrabacion($("micNota"), async blob => {
  avisar("Transcribiendo…", "trabajando", 0);
  try{
    const texto = await transcribir(blob);
    if (!texto){ avisar("No se entendió el audio. Probá de nuevo.", "error"); return; }
    $("cuerpoNota").focus();
    document.execCommand("insertText", false, ($("cuerpoNota").textContent ? "\n" : "") + texto);
    guardarNota();
    avisar("Texto agregado");
  }catch{ avisar("No se pudo transcribir", "error"); }
});

$("borrarNota").onclick = () => {
  if (!confirm("¿Eliminar esta nota?")) return;
  notas = notas.filter(n => n.id !== idAbierto);
  guardar();
  ir("notas");
};

/* --- Editor de lista --- */
$("tituloLista").oninput = guardarLista;
$("addItem").onclick = () => { agregarItem($("nuevoItem").value); $("nuevoItem").value = ""; $("nuevoItem").focus(); };
$("nuevoItem").onkeydown = e => { if (e.key === "Enter") $("addItem").click(); };

$("micLista").onclick = () => alternarGrabacion($("micLista"), async blob => {
  avisar("Transcribiendo…", "trabajando", 0);
  try{
    const texto = await transcribir(blob);
    if (!texto){ avisar("No se entendió el audio. Probá de nuevo.", "error"); return; }
    texto.split(/[,;]| y | luego /i).map(t => t.trim()).filter(Boolean).forEach(agregarItem);
    avisar("Ítem agregado");
  }catch{ avisar("No se pudo transcribir", "error"); }
});

$("borrarLista").onclick = () => {
  if (!confirm("¿Eliminar esta lista?")) return;
  listas = listas.filter(l => l.id !== idAbierto);
  guardar();
  ir("listas");
};

/* --- Botón atrás del celular --- */
window.addEventListener("popstate", () => {
  if (vista === "nota")  ir("notas");
  if (vista === "lista") ir("listas");
});

/* ============================================================
   TEMAS
   ============================================================ */
const Tema = {
  NEO_BRUTALISTA: "neo-brutalista",
  Y2K: "y2k",
  clave: "llavero_tema"
};

function cargarTema(){
  const temaGuardado = localStorage.getItem(Tema.clave);
  if (temaGuardado === Tema.Y2K){
    document.body.classList.add("tema-y2k");
    // Opcional: cambiar icono a estrella (ya está como star, pero podríamos cambiar)
  } else {
    document.body.classList.remove("tema-y2k");
  }
}

function guardarTema(tema){
  localStorage.setItem(Tema.clave, tema);
}

function alternarTema(){
  const esY2K = document.body.classList.toggle("tema-y2k");
  const tema = esY2K ? Tema.Y2K : Tema.NEO_BRUTALISTA;
  guardarTema(tema);
}

/* ============================================================
   ARRANQUE
   ============================================================ */
cargar();
cargarTema(); // Cargar tema guardado
ir("notas");