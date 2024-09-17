// PidaLa.info 2023
let waitingForElements;
let waitCaptcha;
let TANDA_SIZE = 33; //Cantidad de estados a pedir

// This is for communication with background
chrome.runtime.onConnect.addListener(function (port) {
    // console.log('content runtime onConnect', port);
    port.onMessage.addListener(function (msg) {
        // console.log('content port onMessage', port, msg);
        // console.log("msg",msg);
        waitCaptcha = setInterval(detectCaptcha,500);

        if (msg.url && msg.url.match("datos-abiertos")) {
            waitingForElements = setInterval(injectOpenData, 1000);
        }
    });
});

function detectCaptcha() {
        let detectIframe = $('iframe');
        if (detectIframe.length > 0 && detectIframe[0].title.indexOf("Cloudflare") > -1) {
            let bounding = detectIframe[0].getBoundingClientRect();
            if(bounding.width > 0) {
                clearInterval(waitCaptcha);
                // Click on the box!
                // setTimeout(clickCaptcha, 10000, bounding.left+25, bounding.top+25, detectIframe[0])
                console.log("pdr captcha", bounding.top, bounding.left);
            }
        }
}

/*
function clickCaptcha(x,y,el){
    let checkbox = $(el).contents().find('input');
    console.log('box', checkbox)
    let ev = new MouseEvent(
        "click", {
            bubbles: true,
            cancelable: true,
            view: window
        }
    );
    el.dispatchEvent(ev);
    console.log('clicked on', x, y);
}
*/

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
    if ($("#p-tabpanel-0-label").length == 0) {
        return injectionFailed();
    }

    console.log("injectOpenData");
    try {

        params = JSON.parse($("h5._color-rosa").text());
        console.log("pdr params",params);
    }
    catch(e) {
        // missingParamsCounter++;
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
            organoEmail = params.email.replace('@', '+' + (idOrgano-1) + '-' + (Math.floor(Math.random() * 1000) + 1) + '@');
            await fetch("https://www.plataformadetransparencia.org.mx/gwpnt/api/datosAbiertos/datosAbiertos/sisai/crearPeticion", {
            //   "body": "{\"correo\":\""+organoEmail+"\",\"formato\":\"csv\",\"peticion\":{\"idOrganoGarante\":"+idOrgano+",\"idTipoBusqueda\":1,\"idTipoPeriodo\":2,\"fechaInicio\":\""+fechaInicio+"\",\"fechaFin\":\""+fechaFin+"\",\"idSujetoObligado\":null,\"dsFolio\":null}}",
              "body": "{\"formato\":\"CSV\",\"correo\":\""+organoEmail+"\",\"fechaFin\":\""+fechaFin+"\",\"fechaInicio\":\""+fechaInicio+"\",\"folio\":null,\"idTipoBusqueda\":1,\"idTipoPeriodo\":2,\"organoGarante\":{\"id\":"+idOrgano+"},\"sujetoObligado\":null,\"idTipoRespuesta\":null,\"idEstatus\":null}",

              "method": "POST",
              "headers": {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json",

              }
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


// fetch("https://www.plataformadetransparencia.org.mx/gwpnt/api/datosAbiertos/datosAbiertos/sisai/crearPeticion", {
//     "headers": {
    //       "accept-language": "es-ES,es;q=0.9",
//       "accept": "application/json, text/plain, */*",
//       "content-type": "application/json",
//       "priority": "u=1, i",
//       "sec-ch-ua": "\"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\", \"Google Chrome\";v=\"128\"",
//       "sec-ch-ua-mobile": "?0",
//       "sec-ch-ua-platform": "\"Linux\"",
//       "sec-fetch-dest": "empty",
//       "sec-fetch-mode": "cors",
//       "sec-fetch-site": "same-origin",
//       "cookie": "__cf_bm=MZiXIxYHsLUx8twM3vmO9gjMwGPPwM.0kmftBBLXJ4M-1726594736-1.0.1.1-7OZ3Tq9takwd90cKDizCTuScrrVjC7tGge_aZ2T1v4PkrvheQWtCsAt6CFJqKqCdLCZIHLKflWX6cETIStnf4Q; cf_clearance=pe2KSzSLl2_1.3quv3Juo2CB_HEaUV0DhboNFMIGzho-1726594751-1.2.1.1-qVEO2cTu0ns82fgzP6jeq7w9geJWQivqaFJBVBCfTjJtT2TVvxagOFKqGK2V.TMgKq1DtotghAYhy4Jrwg_s8uBiO2SrAvz8_P2qG2tz27XvDPfWG5ZkrNRoVk4IW7M4Lp8MqQnNFS8e0bLG0OahroMrrRwPv6SQS.C3m5P2aoTd5rvhOFaUeFBgpdTnKg25XNN4icoFP7EoG5EwVitx0FDBGyuhXYIWpRNNnulHv3cYDzgHlGEgf5u8DH4tpGavOCIGjdOrsbGzuC.uZ6kEvbnlInVnCY4MuUkof9lsj0FcE5EQRFMsrvFL5ptxFi_Kyncv85H6jhcPlC6Tbi2hXCMjeHr9cWIwKtC_vco.dePqq.yDZdOZhY8g_SstqDGd",
//       "Referer": "https://www.plataformadetransparencia.org.mx/datos-abiertos",
//       "Referrer-Policy": "no-referrer-when-downgrade"
//     },
//     "method": "POST"
//   });