
const CDP = require('chrome-remote-interface');
var fs = require('fs');
const path = require('path');
const { EventEmitter } = require('stream');

const chromePath = process.env.CHROME_PATH || "google-chrome";
const chromePort = process.env.CHROME_PORT || 37195;
const chromeProxy = process.env.CHROME_PROXY || "";

//These can change from download_file
let startingUrl = process.env.STARTING_URL || 'https://www.plataformadetransparencia.org.mx/es/web/guest/datos_abiertos';
let chromeDownloadPath = process.env.CHROME_DOWNLOAD_PATH || __dirname+"/downloads"
let chromeDownloadFilename = null;

const pidalaMailAddress = process.env.PIDALA_MAIL_ADDRESS || "pntdata@abrimos.info";
const dailyLogFolder = __dirname+"/log.daily/"

const flags = [
    '--disable-component-extensions-with-background-pages',
    '--disable-client-side-phishing-detection',
    '--no-first-run',
    '--remote-debugging-port='+chromePort,
    '--disable-features=Translate,OptimizationHints,MediaRouter',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--disable-default-apps',
    '--no-default-browser-check',
    '--no-sandbox',
    // '--disable-web-security',
    // '--metrics-recording-only',
    // '--mute-audio',
    // '--disable-backgrounding-occluded-windows',
    // '--disable-renderer-backgrounding',
    // '--disable-background-timer-throttling',
    // '--password-store=basic',
    // '--use-mock-keychain',
]

if (process.env.CHROME_DATADIR) {
    flags.push("--user-data-dir="+process.env.CHROME_DATADIR);
}
if (process.env.CHROME_EXTENSION_PATH) {
    flags.push("--load-extension="+process.env.CHROME_EXTENSION_PATH);
}
if (process.env.CHROME_PROXY) {
    flags.push("--proxy="+process.env.CHROME_PROXY);
}

let errorCount;
let params;
// request_pnt_data();

module.exports = { request_pnt_data, download_file }

let requestlog;
let child2;

async function request_pnt_data(retry) {
    startingUrl = process.env.STARTING_URL || 'https://www.plataformadetransparencia.org.mx/es/web/guest/datos_abiertos';
    mode="request";
    console.log("request_pnt_data");
    requestlog = [];
    if (!retry) {
        errorCount = -1;
    }

    params = calculateParams();
    console.log("iniciando de",params.fechaInicio,"a",params.fechaFin,"quedan",params.organos.length);

    if (params.organos.length > 0) {
        child2 = await startBrowser();
        // console.log("child2",child2);
    }
    else {
        console.log("pdr finished");
    }

    console.log("request_pnt_data","returning",errorCount);

    return {log: requestlog, errors: errorCount};
}

let downloadlog;
let mode;
async function download_file(src,dest,filename,retry) {
    mode="download";

    console.log("download_file");
    downloadlog = {};
    if (!retry) {
        errorCount = -1;
    }
    startingUrl = src;
    chromeDownloadPath = dest;
    chromeDownloadFilename = filename;
    child2 = await startBrowser("download");
    console.log("pdr finished");

    console.log("download_file","returning",errorCount);

    return downloadlog;
}


/*
la extensión abre el log de hoy y se fija si ya pidió exitosamente todos los estados
  si lo hizo bien
    no hace nada
    guarda un archivo que dice uqe ya está todo bien
  si falta o no existe el archivo
    se fija si hay log de ayer hasta que encuentre un archivo
    pide cada día de cada estado
    guarda un archivo de log
*/
function calculateParams() {
    const params = {
        fechaInicio: "24/08/2023",
        fechaFin: "25/08/2023",
        organos: [],
        dateoffset: 0,
        endoffset: 1,
        email: pidalaMailAddress
    }

    let date = "";
    logfound = false;
    let limit = 99;

    while (!logfound && limit > 0) {
        let dateoffset = 100-limit;
        limit--;
        date = getDate(dateoffset,"-");
        // console.log(i,date);
        logfilename = dailyLogFolder + "pdr-"+date+".log";

        try {
            logcontents = fs.readFileSync(logfilename, 'utf8');
            logfound=true;
            console.log("log for date found",date);

            params.dateoffset = dateoffset;
            params.fechaInicio = getDate(dateoffset,"/",true);
            params.fechaFin = getDate(1,"/",true);
            params.organos = new Array();

            for (let i=1;i<=33;i++) {
                //Si no está este organo en ok en el log, entonces lo agregamos
                if (logcontents.indexOf(" "+i+" ok") == -1) {
                    // console.log("not found",i)
                    params.organos.push(i);
                }
                else {
                    // console.log("found",i)
                }
            }

            if (params.organos.length == 0 && dateoffset > 1) {
                params.dateoffset = dateoffset-1;
                params.fechaInicio = getDate(dateoffset-1,"/",true);
                params.fechaFin = getDate(1,"/",true);
                params.organos = new Array();
                for (let i=1;i<=33;i++) {
                    params.organos.push(i);
                }
            }
        }
        catch(e) {
            console.log("log for date not found",date);
            // console.log(e);
        }
    }
    return params;
}

function getDate(offset,separator,reverse) {
    date = new Date();
    // console.log(date.toLocaleString(),date.time);
    date.setDate(date.getDate() - offset);
    year = date.getFullYear().toString();
    month = (date.getMonth()+1).toString();
    day = date.getDate().toString();

    //Add leading zeros
    if (month.length == 1) { month = "0"+month};
    if (day.length == 1) { day = "0"+day};

    datestring = year+separator+month+separator+day;
    if (reverse) {
        datestring = day+separator+month+separator+year;
    }
    return datestring;
}

function writeLog(dateoffset,lines) {
    const date = getDate(dateoffset,"-");
    const logfilename = dailyLogFolder+"/pdr-"+date+".log";
    const fd = fs.openSync(logfilename, 'a');
    fs.writeFileSync(fd,lines.join("\n")+"\n");
}

async function retryStartBrowser(cause) {
    console.log("retry start browser",errorCount,"mode",mode,"cause",cause);
    if (errorCount <= 6) {
        params = calculateParams();
        console.log("iniciando reintento",params.fechaInicio,"quedan",params.organos.length);

        child2 = await startBrowser();
    }
    else {
        console.log("too many retries, resolving promise");
        // child2.kill("too many retries");
        browserPromises.map(resolve => resolve(1));
        // console.log("resolved promises",browserPromises);
    }
}

//abre el navegador con la extensión
//monitorea la salida
//inicia el protocolo de control
async function startBrowser() {
    //First tries to connect to an instance that's already running
    let child;
    childBrowser = CDP({
        port: chromePort
    }).then(protocol => {
        //If chrome is running, we connect
        initcdp(protocol);
    }).catch(e=>{
        console.log("PDR: Can't connect to Chrome or Chrome not running",e);
        errorCount++;
        if (errorCount > 3) {
            child = new EventEmitter();
            child.emit("exit");
        }

        var childProc = require('child_process');
        const childCommand = ''+chromePath+' '+flags.join(" ")+' ';
        console.log(childCommand);

        childBrowser = childProc.exec(childCommand, (error) => {
            console.log("Browser process ended:",error);
            if(mode=="download") {
                browserPromises.map(resolve => resolve(1));
            }
        });

        if (mode == "request") {
            childBrowser.on("exit",()=>{ retryStartBrowser(mode,"exit")} );
            childBrowser.on("error",()=>{ retryStartBrowser(mode,"error")});
        }

        childBrowser.stdout.on('data', function(data) {
            //Here is where the STDOUT output goes
            console.log('stdout: ' + data);
        });
        childBrowser.stderr.on('data', function(data) {
            //Here is where the STDERR output goes
            // console.log('stderr: ' + data);
            if (data.indexOf("DevTools") > -1) {
                return startBrowser();
            }
        });
    })

    let promise = new Promise((res,rej)=>{
        browserPromises.push(res);
    });
    return promise;
}

let browserPromises = [];
let killTimeout=null;
let paramsInterval = null;

//procolo de control
//configura ruta de descargas
//monitorea carga de la página
//monitorea consola
//monitorea las descargas
async function initcdp(protocol) {
    console.log("initcdp","conectado a chrome");

    const {
        Console,
        Page,
        Browser,
        Network,
        Runtime,
        Storage,
    } = protocol;

    await Promise.all([Console.enable(), Page.enable(), Runtime.enable()]);
    // console.log(await Storage.getSharedStorageEntries("local"));
    Page.setDownloadBehavior({
        behavior: 'allow',
        downloadPath: chromeDownloadPath,
        eventsEnabled: true //set true to emit download events (e.g. Browser.downloadWillBegin and Browser.downloadProgress)
    })
    console.log('mode:', mode);
    if(mode=="download") {

        downloadlog.downloadPath = chromeDownloadPath;
        downloadlog.url = startingUrl;

        killTimeout = setTimeout(()=>{
            console.log("Browser download timeout connect, kill");
            kill("timeout download");
        },15000)

        Page.downloadWillBegin ( (event) => {
            //some logic here to determine the filename
            //the event provides event.suggestedFilename and event.url
            suggestedFilename[event.guid] = event.suggestedFilename;
            // console.log("downloadWillBegin",event);
        });
        let suggestedFilename = {};

        Page.downloadProgress ((result) => {
            // console.log("downloadProgress", result);
            if (result.state == "completed") {
                console.log("download completed, kill",suggestedFilename[result.guid]);
                downloadlog.status = "download completed";
                downloadlog.suggestedFilename = suggestedFilename[result.guid];
                let ext = downloadlog.suggestedFilename.split(".")[downloadlog.suggestedFilename.split(".").length-1];
                if (chromeDownloadFilename) {
                    chromeDownloadFilename = chromeDownloadFilename + "." + ext;
                    downloadlog.chromeDownloadFilename = chromeDownloadFilename;
                    console.log("rename",suggestedFilename[result.guid],"to",chromeDownloadFilename);
                    fs.renameSync(path.resolve(chromeDownloadPath, suggestedFilename[result.guid]), path.resolve(chromeDownloadPath, chromeDownloadFilename));
                }
                kill("completed");
            }
            else {
                clearTimeout(killTimeout);
                killTimeout=null;
                delete killTimeout;

                killTimeout = setTimeout(()=>{
                    console.log("Browser download timeout, kill");
                    kill("timeout download");
                }, 30000)

                if(result.state == "canceled") {
                    downloadlog.status = "download canceled";
                    kill("download canceled");
                }
            }
        });

    }
    else {
        Page.loadEventFired(async (e)=>{
            clearTimeout(killTimeout);
            killTimeout=null;
            delete killTimeout;

            killTimeout = setTimeout(()=>{
                console.log("Browser action timeout, kill");
                kill("timeout");
            },10000)

            // console.log(await Page.getNavigationHistory())
            console.log("page loaded",e);
            clearInterval(paramsInterval);
            console.log("check params ready")
            paramsInterval = setInterval(()=>{
                Runtime.evaluate({ expression: 'console.log("pdr params",$(".title-morado").length)' });
            },100)

            // Runtime.evaluate({ expression: `askOpenData();` });
        })

        Network.requestWillBeSent((result) => { console.log(result); })
    }

    setTimeout( () => {
        Page.navigate({url: startingUrl}).catch(e=> {
            console.error("Navigation error", e, startingUrl, mode);
            kill("navigation error");
        });
    }, 2000 );

    // console.log(await Page.VisualViewport());
    // REMARKS: messageAdded is fired every time a new console message is added

    Console.messageAdded((result) => {
        const text = result.message.text;
        if (text.indexOf("pdr") > -1) {
            console.log("console:",result.message.text);
            clearTimeout(killTimeout);
            delete killTimeout;

            if (text.indexOf("pdr params") > -1) {
                clearInterval(paramsInterval);

                paramsText = JSON.stringify(params).replace(/\"/g,"\\\"");
                console.log("Sending params",paramsText);
                Runtime.evaluate({ expression: '$(".title-morado").text("'+paramsText+'")' });
            }

            if (text.indexOf("pdr injection fail") > -1) {
                // console.log("HACER CLICK");
                // click((Page.VisualViewport.width/2)-150+35,497);
            }
            if (text.indexOf("pdr log") > -1) {

                //Don't log skipped organos
                if (text.indexOf("skip") == -1) {
                    requestlog.push(text);
                }
                // click((Page.VisualViewport.width/2)-150+35,497);
            }

            if (text.indexOf("pdr finish") > -1) {
                writeLog(params.endoffset,requestlog);
                requestlog = [];
                console.log("finish requesting, kill");
                kill("finish");
            }
        }
    });

    function kill(source) {
        console.log("kill",source);
        clearTimeout(killTimeout);
        clearInterval(paramsInterval);
        killTimeout=null;
        if(mode=="download") downloadlog.status = source;

        try {
            Page.close();
        }
        catch(e) {
            console.error("Browser already killed",e);
        }
        if(mode=="download") {
            browserPromises.map(resolve => resolve(1));
        }
    }

    function click(x,y) {
        const options = {
            x: x,
            y: x,
            button: 'left',
            clickCount: 1
        };
        Promise.resolve().then(() => {
            options.type = 'mousePressed';
            return protocol.Input.dispatchMouseEvent(options);
        }).then(() => {
            options.type = 'mouseReleased';
            return protocol.Input.dispatchMouseEvent(options);
        }).catch((err) => {
            console.error('click', err);
        }).then(() => {
            protocol.close();
        });
    }

}
