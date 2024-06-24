// PidaLa.info 2023
console.log("extension loaded");
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
