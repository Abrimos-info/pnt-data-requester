
const CDP = require('chrome-remote-interface');

const startingUrl = process.env.STARTING_URL || 'https://www.plataformadetransparencia.org.mx/web/guest/datos_abiertos';
const chromePath = process.env.CHROME_PATH || "google-chrome";
const chromePort = process.env.CHROME_PORT || 37195;
const chromeProxy = process.env.CHROME_PROXY || "";
const chromeDownloadPath = process.env.CHROME_DOWNLOAD_PATH || __dirname+"/downloads"
const pidalaMailAddress = process.env.PIDALA_MAIL_ADDRESS || "pntpidala@mailcatch.com";

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


var childProc = require('child_process');
const childCommand = ''+chromePath+' '+flags.join(" ")+' '+startingUrl+' ';
console.log(childCommand);
let child = childProc.exec(childCommand, (error) => {
  console.log(error);
});


child.stdout.on('data', function(data) {
  //Here is where the output goes
  
  console.log('stdout: ' + data);
  
  data=data.toString();
  // scriptOutput+=data;
});
child.stderr.on('data', function(data) {
  //Here is where the output goes
  
  // console.log('stderr: ' + data);
  if (data.indexOf("DevTools") > -1) {
    startcdp();
  }
  
  // data=data.toString();
  // scriptOutput+=data;
});

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
  // Page.loadEventFired(async ()=>{
  //   console.log(await Page.getNavigationHistory())
  //   Runtime.evaluate({ expression: `askOpenData();` });
  // })

  Page.downloadProgress ((result) => {
    if (result.state == "completed") {
        console.log("download completed");
        kill();
      }
    });
  
  // REMARKS: messageAdded is fired every time a new console message is added
  Console.messageAdded((result) => {
    const text = result.message.text;
    if (text.indexOf("pdr") > -1) {
      console.log("console:",result.message.text);

      if (text.indexOf("pdr injection fail") > -1) {
        click(816,497);
      }
  
      if (text.indexOf("pdr finish") > -1) {
        console.log("finish");
        kill();
      }
    }


  });

  function kill() {
    console.log("kill");
    Browser.close();
    protocol.close();
    process.exit();
  }

  function click(x,y) {
    const options = {
      x: 42,
      y: 42,
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
      client.close();
  });    
  }
}


const askfn = `let requestlog = {};
const pidalaMailAddress = '${pidalaMailAddress}';
console.log("pidalaMailAddress",pidalaMailAddress);
async function askOpenData() {
    console.log("askOpenData");
    for (let idOrgano = 1; idOrgano < 3; idOrgano++) {
        // await timeout(DEMORA_PNT*idOrgano);
        requestlog[idOrgano] = {'statusCode': 1};
        // console.log("requestlog",requestlog);
        await fetch("https://www.plataformadetransparencia.org.mx/web/guest/datos_abiertos?p_p_id=mx_org_inai_datosabiertos_Sisai_datos_abiertosPortlet_INSTANCE_JUPdRlXXWq6A&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=%2Finai%2FdatosAbiertos%2FexportarDatosAbiertos&p_p_cacheability=cacheLevelPage", {
          "body": "{\"correo\":\""+pidalaMailAddress+"\",\"formato\":\"csv\",\"peticion\":{\"idOrganoGarante\":"+idOrgano+",\"idTipoBusqueda\":1,\"idTipoPeriodo\":2,\"fechaInicio\":\"24/08/2023\",\"fechaFin\":\"27/08/2023\",\"idSujetoObligado\":null,\"dsFolio\":null}}",
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


console.log("pdr finish");
// makeDownload("log",JSON.stringify(requestlog));
}`