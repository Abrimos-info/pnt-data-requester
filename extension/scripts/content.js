// PidaLa.info 2023
var manifest = chrome.runtime.getManifest();

const devMode = manifest.version_name.indexOf("dev") > -1;
if (devMode) {
    console.log("Content devMode",devMode);
}

let waitingForElements;

let TANDA_SIZE = 33; //Cantidad de estados a pedir

// This is for communication with background
chrome.runtime.onConnect.addListener(function (port) {
    // console.log('content runtime onConnect', port);
    port.onMessage.addListener(function (msg) {
        // console.log('content port onMessage', port, msg);
        // console.log("msg",msg);

        if (msg.url && msg.url.match("es/web/guest/datos_abiertos")) {
            waitingForElements = setInterval(injectOpenData, 1000);
        }
    });
});

let injectionFails=0;
function injectionFailed() {
    injectionFails++;
    if (injectionFails == 4 || injectionFails == 20 || injectionFails == 100) {
        console.log("pdr injection fail");
    }

    if ($(".cf-error-details").length > 0) {
        clearInterval(waitingForElements);
        console.log("pdr finish - injection timeout");
    }
}

//Monitoreo de clicks
$("body").click((e) => {
    console.log("pdr click",JSON.stringify(e),e.clientX,e.clientY,e.pageX,e.pageY);
});
let missingParamsCounter = 0;
async function injectOpenData() {
    if ($("#tipoBusqueda-1").length == 0) {
        return injectionFailed();
    }

    console.log("injectOpenData");
    try {

        params = JSON.parse($(".title-morado").text());
        console.log("pdr params",params);
    }
    catch(e) {
        if (missingParamsCounter > 10) {
            console.log("pdr finish", "missing params");
        }
        return;
    }
    clearInterval(waitingForElements);
    for (let idOrgano = 1; idOrgano <= TANDA_SIZE; idOrgano++) {
        fechaInicio = params.fechaInicio;
        fechaFin = params.fechaFin;
        let logitem = fechaInicio+" "+idOrgano;

        console.log(idOrgano,params.organos,params.organos.indexOf(idOrgano));
        let organoEmail = '';
        if (params.organos.indexOf(idOrgano) > -1 ) {
            organoEmail = params.email.replace('@', '+' + idOrgano + '@');
            await fetch("https://www.plataformadetransparencia.org.mx/es/web/guest/datos_abiertos?p_p_id=mx_org_inai_datosabiertos_Sisai_datos_abiertosPortlet_INSTANCE_JUPdRlXXWq6A&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=%2Finai%2FdatosAbiertos%2FexportarDatosAbiertos&p_p_cacheability=cacheLevelPage", {
              "body": "{\"correo\":\""+organoEmail+"\",\"formato\":\"csv\",\"peticion\":{\"idOrganoGarante\":"+idOrgano+",\"idTipoBusqueda\":1,\"idTipoPeriodo\":2,\"fechaInicio\":\""+fechaInicio+"\",\"fechaFin\":\""+fechaFin+"\",\"idSujetoObligado\":null,\"dsFolio\":null}}",
              "method": "POST",
              "credentials": "include"
            }).then((a)=> {
            //   console.log(idOrgano);
              a.json().then(b=> {
                console.log("pdr log",logitem,(b.statusCode == 0 ? "ok" : "fail"),JSON.stringify(b));
            }).catch((e)=> {
                console.log("pdr log",logitem,"fail",JSON.stringify(e));

            })
            }).catch((e)=> {
                console.log("pdr log",logitem,"fail",JSON.stringify(e));

            })
        }
        else {
            console.log("pdr log",logitem,"skip");
        }
    }

setTimeout(()=>{

    console.log("pdr finish");
}, 1000)
}
