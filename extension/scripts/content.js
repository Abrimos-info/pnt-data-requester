// PidaLa.info 2023
var manifest = chrome.runtime.getManifest();

const devMode = manifest.version_name.indexOf("dev") > -1;
if (devMode) {
    console.log("Content devMode",devMode);
}

let TANDA_SIZE = 33;
const DEMORA_PNT = 100 * 1000; //100 segundos en milisegundos
function updateBatchSize(num) { TANDA_SIZE = num }
const PRESET_REQUEST_TEXT = "[Ingresa aquí el texto de tu solicitud, describiendo con precisión la información que quieres saber]\n\nEn caso de que la respuesta sea mayor al tamaño máximo que soporta la PNT (20mb) por favor enviarlo por correo electrónico a [pnt_user_mail] o utilizando un servicio de envío de archivos grandes como Google Drive, WeTransfer, Dropbox u otro de su preferencia.";
const PIDALA_SIGNATURE = "\n\nSolicitud enviada mediante pidala.info";
let pidalaSignatureEnabled = false;

let pidala_settings = {};

/** INICIALIZAR INTERFAZ */
function isLoggedInPNT() {
    let loginElem = $("#navbarSISAI li.isLogged");
    if (loginElem.length > 0) return true;
    return false;
}

let waitingForScripts = null;
let waitingForElements = null;
let waitingForElementsL = null;
let waitingForElements2 = null;
let waitingForElements3 = null;
let waitingForElements4 = null;



let pageInit = false;
let pageInitHistorial = false;
let wixPlanStatus = null;
let wixPlanName = null;
// This is for communication with background
chrome.runtime.onConnect.addListener(function (port) {
    // console.log('content runtime onConnect', port);
    port.onMessage.addListener(function (msg) {
        // console.log('content port onMessage', port, msg);

        chrome.storage.local.get(["pidala_settings"]).then(data => {
            pidala_settings = data.pidala_settings;
            if (!pidala_settings) {
                pidala_settings = {}
            }
            console.log("pidala_settings",pidala_settings);
            // console.log("content por onmessage storage",data,pageInit,"waitingForElementsL",waitingForElementsL);

            // console.log("msg",msg);
            if (msg.url && msg.url.match("/web/guest/datos_abiertos")) {
                waitingForElements = setInterval(injectOpenData, 1000);
            }
        })
    });
});

function injectOpenData() {
    clearInterval(waitingForElements);
    console.log("injectOpenData");
    $("#column-1").prepend(`<div id="askOpenDataBtn" class="btn">
    Pedir datos de hoy

    </div>
    `)

    $("#askOpenDataBtn").click(askOpenData);

    setTimeout(()=>{
        askOpenData();
    }, 1000);
}

let requestlog = {};
async function askOpenData() {
    console.log("askOpenData");
    for (let idOrgano = 1; idOrgano < 4; idOrgano++) {
        // await timeout(DEMORA_PNT*idOrgano);
        requestlog[idOrgano] = {'statusCode': 1};
        // console.log("requestlog",requestlog);
        await fetch("https://www.plataformadetransparencia.org.mx/web/guest/datos_abiertos?p_p_id=mx_org_inai_datosabiertos_Sisai_datos_abiertosPortlet_INSTANCE_JUPdRlXXWq6A&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=%2Finai%2FdatosAbiertos%2FexportarDatosAbiertos&p_p_cacheability=cacheLevelPage", {
          "body": "{\"correo\":\"pntpidala@mailcatch.com\",\"formato\":\"csv\",\"peticion\":{\"idOrganoGarante\":"+idOrgano+",\"idTipoBusqueda\":1,\"idTipoPeriodo\":2,\"fechaInicio\":\"24/08/2023\",\"fechaFin\":\"27/08/2023\",\"idSujetoObligado\":null,\"dsFolio\":null}}",
          "method": "POST",
          "credentials": "include"
        }).then((a)=> {
        //   console.log(idOrgano);
          a.json().then(b=> {
            requestlog[idOrgano] = b;
            console.log("pdr",idOrgano,JSON.stringify(b));
        })
        })
    }

setTimeout(()=>{

    console.log("pdr finish");
}, 1000)
// makeDownload("log",JSON.stringify(requestlog));
}


function getCSVHeaders(data) {
    const headers  = [
        "idOrgano",
        "status",
        "Sujeto Obligado",
        "Órgano Garante",
        "En proceso",
        "URL Historial PNT",
        ]
    return '"'+headers.join('","')+"\"\n";
}
function getCSVData(data) {
    let csv = "";
    console.log("getCSVData",data);

    for (let d in data) {
        let s = data[d];

        let csvArray = [
            s.idSolicitud,
            s.folio ? s.folio.trim() : "",
            s.dependencia.trim(),
            s.estado.trim(),
            s.isEnProceso,
            s.urlPNT,
        ]
        // console.log(s);

        //Generar CSV
        csv += '"'+csvArray.join('","')+"\"\n";
    }
    return csv;
}


function makeDownload(filename,text) {
    const BOM = new Uint8Array([0xEF,0xBB,0xBF]);
    const blobURL = URL.createObjectURL(new Blob([BOM,text]),{encoding:"UTF-8",type:"text/plain;charset=UTF-8"});

    // const blobURL = URL.createObjectURL(new Blob([text]));
    // Create the `<a download>` element and append it invisibly.
    const a = document.createElement('a');
    a.href = blobURL;
    const date = new Date();
    a.download = "[pnt-data-request] "+date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate()+" "+filename;
    a.style.display = 'none';
    document.body.append(a);
    // Programmatically click the element.
    a.click();
    // Revoke the blob URL and remove the element.
    setTimeout(() => {
        URL.revokeObjectURL(blobURL);
        a.remove();
    }, 1000);

}
