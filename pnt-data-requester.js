
const CDP = require('chrome-remote-interface');
var fs = require('fs');

const startingUrl = process.env.STARTING_URL || 'https://www.plataformadetransparencia.org.mx/web/guest/datos_abiertos';
const chromePath = process.env.CHROME_PATH || "google-chrome";
const chromePort = process.env.CHROME_PORT || 37195;
const chromeProxy = process.env.CHROME_PROXY || "";
const chromeDownloadPath = process.env.CHROME_DOWNLOAD_PATH || __dirname+"/downloads"
const pidalaMailAddress = process.env.PIDALA_MAIL_ADDRESS || "pntpidala@mailcatch.com";
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

let params;
request_pnt_data();

function request_pnt_data() {
  params = calculateParams();
  console.log("iniciando",params.fechaInicio,"quedan",params.organos.length);
  
  if (params.organos.length > 0) {
    let child = startBrowser();
    child.on("exit",request_pnt_data)  
  }
  else {
    console.log("pdr finished");
  }
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
        params.fechaFin = getDate(dateoffset-1,"/",true);
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
          params.fechaFin = getDate(dateoffset-2,"/",true);
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

//abre el navegador con la extensión
//monitorea la salida
//inicia el protocolo de control
function startBrowser() {
  var childProc = require('child_process');
  const childCommand = ''+chromePath+' '+flags.join(" ")+' '+startingUrl+' ';
  console.log(childCommand);
  let child = childProc.exec(childCommand, (error) => {
    console.log("Browser process ended:",error);
  });
  
  
  child.stdout.on('data', function(data) {
    //Here is where the STDOUT output goes
    
    console.log('stdout: ' + data);
    
    data=data.toString();
    // scriptOutput+=data;
  });
  child.stderr.on('data', function(data) {
    //Here is where the STDERR output goes
    
    console.log('stderr: ' + data);
    if (data.indexOf("DevTools") > -1) {
      startcdp();
    }
    
    // data=data.toString();
    // scriptOutput+=data;
  });

  return child;
}


//procolo de control
//configura ruta de descargas
//monitorea carga de la página
//monitorea consola
//monitorea las descargas
async function startcdp() {
  // const chromeport = data.split(":")[2].split("/")[0];
  // console.log("startcdp");
  const protocol = await CDP({
    port: chromePort
  });

  const {
    Console,
    Page,
    Browser,
    Runtime,
    Storage,
  } = protocol;

  await Promise.all([Console.enable(), Page.enable(), Runtime.enable()]);
  // console.log(await Storage.getSharedStorageEntries("local"));
  Page.setDownloadBehavior({ behavior: 'allow', downloadPath: chromeDownloadPath})
  // Page.addScriptToEvaluateOnNewDocument(askfn,"askfn");
  
  // await Runtime.evaluate({
  //   expression: askfn,
  //   awaitPromise: true
  // });    
  // await Page.stopLoading();
  // console.log("navigate");
  // await Page.navigate({url: startingUrl});
    Page.loadEventFired(async ()=>{
      // console.log(await Page.getNavigationHistory())
      console.log("load");
      setTimeout(()=>{
        paramsText = JSON.stringify(params).replace(/\"/g,"\\\"");
        console.log(paramsText);

        Runtime.evaluate({ expression: '$(".title-morado").text("'+paramsText+'")' });
      },1000)

      // Runtime.evaluate({ expression: `askOpenData();` });
    })

  Page.downloadProgress ((result) => {
    if (result.state == "completed") {
        console.log("download completed");
        kill();
      }
    });
  // console.log(await Page.VisualViewport());
  // REMARKS: messageAdded is fired every time a new console message is added
  let requestlog = [];

  Console.messageAdded((result) => {
    const text = result.message.text;
    if (text.indexOf("pdr") > -1) {
      console.log("console:",result.message.text);

      if (text.indexOf("pdr injection fail") > -1) {
        console.log("HACER CLICK");
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
        writeLog(params.dateoffset,requestlog);
        console.log("finish");
        kill();
      }
    }


  });

  function kill() {
    console.log("kill");
    Browser.close();
    protocol.close();
    // process.exit();
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
        console.error(err);
    }).then(() => {
        protocol.close();
    });    
  }
}

