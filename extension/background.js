// PidaLa.info 2023
var manifest = chrome.runtime.getManifest();

const devMode = manifest.version_name.indexOf("dev") > -1;
if (devMode) {
    console.log("Background devMode",devMode);
}

function pitrack(eventType,eventValue) {
    chrome.storage.local.get('wixUserId').then(data => {
        let event = {
            type: eventType,
            value: eventValue,
            user: data.wixUserId,
            timestamp: Date.now(),
            version: manifest.version
        }
        if (devMode == true) {
            console.log("pitrack disabled",event);
        }
        else {
            fetch("https://api.pidala.info/track", {
                method: "POST",
                body: JSON.stringify(event)
            })
        }
    })
}


chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        // console.log("chrome.runtime.onMessage.addListener",request);
        // console.log(sender);

        switch (request.type) {
            case 'updateBadge':
                chrome.storage.local.get(['pntUserId','pntData', 'pntuptime', 'wixLoginStatus']).then( (data) => {
                    let userData = getUserData(data);
                    updateBadge(userData,data.pntuptime);
                })


            break;
            case 'pitrack':
                let eventValue = request.eventValue || "";
                pitrack(request.eventType, eventValue);
            default:
                console.log("unhandled background message",request);
                break;
        }
        return true;
    }
);

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    // changeInfo object: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onUpdated#changeInfo
    // status is more reliable (in my case)
    // use "alert(JSON.stringify(changeInfo))" to check what's available and works in your case
    // console.log(tabId, changeInfo, tab);

    if (changeInfo.status === 'complete' && tab.url.match(/plataformadetransparencia\.org\.mx/)) {
        let port = chrome.tabs.connect( tabId, { name: 'plusComms' } );
        port.onMessage.addListener(function(msg) {
            console.log('background port onMessage', msg);
        });
        port.postMessage({
            url: tab.url,
            message: 'TabUpdated'
        });
    }
});
