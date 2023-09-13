// PidaLa.info
// Martín Szyszlican - 2023
var manifest = chrome.runtime.getManifest();

const devMode = manifest.version_name.indexOf("dev") > -1;
if (devMode) {
    console.log("Popup devMode",devMode);
}

chrome.runtime.sendMessage({
    type:"pitrack",
    "eventType": "open_popup",
    "eventValue": ""
})

const sujetosexport = { "sujetos": [] };
let solicitudesexport = [];
let botones = {}
let stats = [];
let isOffsite = null;
let isLoggedInPNT = true;
let showReadNotifications = false;

let isLoggedInWix = true;
// chrome.storage.local.get("wixLoginStatus").then(data => isLoggedInWix = data.wixLoginStatus);

//INIT messaging with content
let tab;
chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    tab = tabs[0].id;
    // console.log("init messaging",tabs);
    if (tabs[0].url.match(/plataformadetransparencia\.org\.mx/)) isOffsite = false;
    else isOffsite = true;
    initPNTPopup();
});

let activeCountry = 'mex';
$(function(){
    $('#toggleReadBtn').on('click', notifToggleRead);
    $('#topmenuBtn').on('click', toggleTopMenu);
    $('#flagMenuBtn').on('click', toggleFlagMenu);
    $('#configBtn').on('click', gotoOptions);
    $('#aboutBtn').on('click', function() { gotoLink('https://www.pidala.info', 'acerca_de') });
    $('#helpBtn').on('click', function() { gotoLink('https://www.pidala.info/cuenta/ayuda', 'ayuda') });
    $('#btnArgDerecho').on('click', function() { gotoLink('https://derechoaldato.com.ar/', 'arg_derecho_al_dato') });
    $('#btnArgTramites').on('click', function() { gotoLink('https://tramitesadistancia.gob.ar/', 'arg_tramites') });
    $('#btnColQueremos').on('click', function() { gotoLink('https://www.queremosdatos.co/', 'col_queremos') });
    $('#notificationBtn,#notifBack a').on('click', toggleNotificationLayer);
    $('#notifMarkAllAsRead,#notifMarkSelectedAsRead').on("click",notifMarkAllAsRead);
    $('#notifFilter').on("click",notifFilter);
    $('#btnLogin,#loginArea,#iniciarSesionLink').on('click', iniciarSesion);
    $('#btnLogout').on('click', cerrarSesion);
    $('#btnRefresh').on('click', ()=>{
        actualizarStats();
        chrome.runtime.sendMessage({
            type:"pitrack",
            "eventType": "click_popup_actualizar"
        })
        }   
    );

    $('#btnOpenData').on('click', askOpenData);

    //Individual notifications actions
    $('#notifContent').on("click",".notifOpenPage",notifOpenPage);
    $('#notifContent').on("click",".notifiCal",notifiCal);
    $('#notifContent').on("click",".notifMarkAsRead",notifMarkAsRead);
    $('#notifContent').on("click",".notifMarkAsUnRead",notifMarkAsUnRead);

    $('#notifFilterWindow').on("click",".notifToggleEstatus",notifToggleEstatus);


    $("#pidalaVersion").text(manifest.version_name);


    $('#flagMenu div.flag-item').on('click', function() {
        let country = $(this).attr('id').replace('flagItem', '').toLowerCase();
        console.log(country)
        if(country == activeCountry) return;
        activeCountry = country;

        let countryButton = $(this);
        $('#flagMenu').prepend(countryButton);
        $('div.contentPanel').hide();
        $('#content-' + country).show();
        toggleFlagMenu();

        chrome.runtime.sendMessage({
            type:"pitrack",
            "eventType": "click_popup_flag",
            "eventValue": country
        })
    });
})

function initOffsitePopup() {
    $('#actionArea').hide();
    $('#offsiteActionArea').show();
    $('#popupTopLogo').attr('src', '../images/icon-32.png');

    const botonesMapeo = {}
    initPopup(botonesMapeo);
}

const DEMORA_PNT = 10 * 1000; //10 segundos en milisegundos



// Solicitar datos abiertos
async function askOpenData() {

    setTimeout(()=> {
        chrome.tabs.create({ url: "https://www.plataformadetransparencia.org.mx/web/guest/datos_abiertos" });
    }, 500)

    

    console.log("askOpenData");

}


function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Mapeos de la interfaz
function initPNTPopup() {

    chrome.storage.local.get(['pntUserId','pntData', 'wixLoginStatus', 'wixPlanStatus', 'wixPlanName']).then(data => {
        if (data.wixPlanStatus != "ACTIVE" || data.wixPlanName == "Gratis") {
            $("#feedbackArea").show();
        }
        if(!data.pntUserId) {
            isLoggedInPNT = true;
            $('#offsiteActionArea').hide()
            $('#actionArea').show();
            $('#popupTopLogo').attr('src', '../images/icon-light-32.png');

            updatePopupBadge(data);
        }
        const botonesMapeo = {
            "btnSolicitud": ()=>{
                chrome.runtime.sendMessage({
                    type:"pitrack",
                    "eventType": "click_popup_solicitud"
                })
                setTimeout(()=> {
                    chrome.tabs.create({ url: "https://www.plataformadetransparencia.org.mx/group/guest/sisai_solicitudes#/solicitudes" });
                }, 500)
            },
            "btnExportar": guardarSolicitudes,
            "btnHistorial": ()=>{
                chrome.runtime.sendMessage({
                    type:"pitrack",
                    "eventType": "click_popup_historial"
                })
                setTimeout(()=> {
                    chrome.tabs.create({ url: "https://www.plataformadetransparencia.org.mx/group/guest/sisai_solicitudes#/historial" });
                }, 500)
            }
        }

        initPopup(botonesMapeo);
    });
}

function getUserData(data) {
    if (data && data.pntData) {
        if (data.wixLoginStatus) {
            return data.pntData.filter( obj => obj.userId == data.pntUserId )[0]; // Objeto con toda la data del usuario actual
        }
        else {
            return null;
        }
    }
    else {
        chrome.storage.local.get('pntData').then( (data) => {
            let dataObj = null;
            if(!data.hasOwnProperty('pntData')) {
                dataObj = {
                    'userId': '',
                    'email': '',
                    'historial': [],
                    'notificaciones': [],
                    'statuses': {}
                };
                chrome.storage.local.set({ 'pntData': [ dataObj ] });
            }
        })
    }
    return null;
}


function updatePopupBadge(data) {
    chrome.runtime.sendMessage({type: "updateBadge"});
    //Marcar la campanita
    let userData = getUserData(data);
    if (userData && userData.notificaciones.length) {
        let unreadCount = userData.notificaciones.filter(n => n.notifRead == false).length;
        console.log("unreadCount",unreadCount);
        if (unreadCount > 0) {
            $("#notificationAlert").show();
        }
        else {
            //Hide
            $("#notificationAlert").hide();

        }
    }
    else {
        // No ha sincronizado aun, posiblemente sea nueva instalación
        actualizarStats();
    }

}

function toggleTopMenu() {
    let menu = $('#topmenuWindow');
    if(!menu.is(':visible')) menu.show();
    else menu.hide();
}

function toggleFlagMenu() {
    let menu = $('#flagMenu');
    if(!menu.hasClass('open')) {
        menu.addClass('open');
        $('#flagMenuBtn').attr('src', '../images/chevron-up.png');
    }
    else {
        menu.removeClass('open');
        $('#flagMenuBtn').attr('src', '../images/chevron-down.png');
    }
}

function toggleNotificationLayer() {
    let layer = $('#notificationArea');
    let eventValue = null;

    //Only show notifications when user is logged in
    if (!isLoggedInPNT) {
        return false;
    }

    if(!layer.is(':visible')) {
        layer.show();
        if(!isLoggedInPNT) $('#offsiteActionArea').hide();
        else $('#actionArea').hide();
        $('#summaryArea').hide();
        if(isLoggedInWix) $('#userArea').hide();
        else $('#loginArea').hide();
        $('#notifFilterWindow').hide();


        displayNotifications();

        eventValue = 'show';
    }
    else {
        layer.hide();
        $('#notifFilterWindow').hide();
        if(!isLoggedInPNT) $('#offsiteActionArea').show();
        else $('#actionArea').show();
        $('#summaryArea').show();
        if(isLoggedInWix) $('#userArea').show();
        else $('#loginArea').show();
        eventValue = 'hide';
    }

    chrome.runtime.sendMessage({
        type:"pitrack",
        "eventType": "click_popup_notifications",
        "eventValue": eventValue
    })
}

let notifFilterItems = {}

function displayNotifications() {
    chrome.storage.local.get(['pntUserId', 'pntData']).then(data => {
        if (!data.pntUserId) {
            // TODO: mostrar algo temporal si no hay usuario PNT
            return;
        }
        let userData = data.pntData.filter( obj => obj.userId == data.pntUserId ); // Objeto con toda la data del usuario actual

        let notifications = userData[0].notificaciones;
        let notifHtml = '';

        if(notifications.length > 0) {
            $("#notifMarkAllAsRead,#notifMarkSelectedAsRead").find("img").attr("src","../images/mail-closed.png");

            let statusVisible = true;

            notifications.reverse().map( notif => {
                //Add status to filters
                if (notif.dsEstatus) {

                    if (!notifFilterItems.hasOwnProperty(notif.dsEstatus)) {
                        notifFilterItems[notif.dsEstatus] = true;
                        $('#notifFilterWindow').append("<div class='menuitem'><a href='#' class='notifToggleEstatus'><input type='checkbox' "+(statusVisible?"checked='true'" : "")+"/><span>"+notif.dsEstatus+"</span></a></div>");
                    }
                    statusVisible = notifFilterItems[notif.dsEstatus];
                    $('#notifFilterWindow').find("span:contains("+notif.dsEstatus+")").siblings("input").attr("checked",statusVisible);
                }

                //Show notification
                if ((showReadNotifications || !notif.notifRead) && statusVisible) {
                    switch (notif.notifType) {
                        case "ria":
                            notifHtml += generateNotificationHTML(notif,"Hoy es último día para responder el requerimiento de información adicional.");
                            break;
                        case  "rra":
                            notifHtml += generateNotificationHTML(notif,"Hoy es último día para interponer una queja por la respuesta.");
                            break;
                        case "new":
                            notifHtml += generateNotificationHTML(notif,"Solicitud nueva.");
                            break;
                        default:
                            notifHtml += generateNotificationHTML(notif);
                            break;
                    }
                }
            })

            //Todas las notificaciones estaban marcadas como leídas
            if (notifHtml == "") {
                $("#notifMarkAllAsRead,#notifMarkSelectedAsRead").find("img").attr("src","../images/mail-open.png");
                notifHtml = "No hay notificaciones sin leer."
            }
        }
        else {
            //No notifications in array
            $("#notifMarkAllAsRead,#notifMarkSelectedAsRead").find("img").attr("src","../images/mail-open.png");
            notifHtml += "Aún no se han generado notificaciones desde la instalación."
        }
        $('#notifContent').html(notifHtml);

        console.log("n",$(".notificationItem"),$(".notificationItem .checkbox input"));
        $(".notificationItem .checkbox input").on("click",(e) => {
            console.log("Notification item checked",e);
            let checked = $(".notificationItem .checkbox input:checked");
            //If this is the first one, toggle archve all to archive selected
            if (checked.length == 1 || checked.length == 0) {
                $("#notifMarkAllAsRead,#notifMarkSelectedAsRead").toggle();
            }

        })

    });
}



function generateNotificationHTML(notif,message = "") {
    // console.log('notifications', notif);
    let notifHtml =
    '<div class="notificationItem">' +
        '<div class="checkbox"><input type="checkbox"></div>' +
            '<div class="notificationDetails" '+(notif.notifRead?"style='border:none'":"")+'>'+
            '<div class="date">' + new Date(notif.notifDate).toLocaleString() + '</div>';

    if (notif.notifType == "message") {
        notifHtml +=
            '<div class="title">' + notif.title + '</div>' +
            `
            <div class="details">
                <div class="notifText">${notif.text}</div>
            </div>
            <div class="action">`

    }
    else {
        notifHtml +=
            '<div class="title notifSujeto">' + notif.dsSujetoObligado + '</div>' +
            `
            <div class="details">
                <div class="notifMessage">
                    <i>${message}</i>
                </div>
                <div class="notifEstatus">
                Estatus:
                ${notif.dsEstatus}.
                </div>
                <div class="notifFolio">
                    ${notif.dsFolio}
                    (<span class="notifOrgano">${notif.dsOrganoGarante}</span>)
                </div>
            </div>
            <div class="action">
                <a class="notifOpenPage"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              Ver detalle</a>
                <a class="notifiCal"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              iCal</a>
            `
    }

    if (notif.notifRead) {
        notifHtml +=`<a class="notifMarkAsUnRead"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
      Desarchivar</a>`
    }
    else {
        notifHtml +=`<a class="notifMarkAsRead"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>

      Archivar</a>`

    }
    notifHtml +=`</div>` +
        '</div>' +
    '</div>';

    return notifHtml;
}

let organosData = null;
let organosUrl = chrome.runtime.getURL('organos.json');
fetch(organosUrl)
    .then((response) => response.json()) // file contains json
    .then((json) => {
        organosData = json;
    });



function notifiCal(e) {
    chrome.runtime.sendMessage({
        type:"pitrack",
        "eventType": "click_notif_ical"
    })

    let description = $(e.currentTarget).parents(".notificationDetails").text();
    let organo =  $(e.currentTarget).parents(".notificationDetails").find(".notifOrgano").text().trim();
    let folio =  $(e.currentTarget).parents(".notificationDetails").find(".notifFolio").text().split('(')[0].trim();
    let sujeto =  $(e.currentTarget).parents(".notificationDetails").find(".notifSujeto").text().trim();
    let location = "https://www.plataformadetransparencia.org.mx/group/guest/sisai_solicitudes#/historial#?organo="+organo+"&folio="+folio;

    chrome.storage.local.get(['pntUserId', 'pntData']).then(data => {
        if(!data.pntUserId) return;
        let userData = data.pntData.filter( obj => obj.userId == data.pntUserId ); // Objeto con toda la data del usuario actual
        let solicitud = userData[0].historial.find( s => { return s.dsFolio == folio } );

        let today = new Date();
        let organo = organosData[solicitud.idOrganoGarante];
        let recepcion = new Date( makeValidDate(solicitud.dtRecepcion) );
        let limiteRIA = new Date( agregarDíasHábilesAFecha(solicitud.dtRecepcion, organo.ria) );
        let limiteRespuesta = new Date( makeValidDate(solicitud.dtLimite) ); // Ya viene diferenciada por estado desde la PNT

        let limiteRRA = null;
        if(solicitud.hasOwnProperty('fechaMaximaRra'))
            limiteRRA = new Date( solicitud.fechaMaximaRra );
        else {
            let limiteRespuestaStr = limiteRespuesta.getDay() + "/" + (limiteRespuesta.getMonth() + 1) + "/" + limiteRespuesta.getFullYear();
            limiteRRA = new Date( agregarDíasHábilesAFecha(limiteRespuestaStr, 15) );
        }

        // console.log('notifiCal limiteRRA', limiteRRA, limiteRRA.getTime() > today.getTime());
        // console.log('notifiCal limiteRIA', limiteRIA, limiteRIA.getTime() > today.getTime());
        // console.log('notifiCal limiteRespuesta', limiteRespuesta, limiteRespuesta.getTime() > today.getTime());

        var cal = ics();
        // Evento de respuesta de la solicitud
        if(limiteRespuesta.getTime() > today.getTime())
            cal.addEvent("[pidala.info] Respuesta de " + sujeto, "Fecha límite de respuesta para la solicitud " + folio + ". El órgano responsable de esta solicitud es " + organo + ".", location, limiteRespuesta, limiteRespuesta);
        // Evento de RIA de la solicitud
        if(limiteRIA.getTime() > today.getTime())
            cal.addEvent("[pidala.info] Límite RIA de " + sujeto, "Fecha límite para recibir requerimiento de información adicional para la solicitud " + folio + ". El órgano responsable de esta solicitud es " + organo + ".", location, limiteRIA, limiteRIA);
        // Evento de RRA de la solicitud
        if(limiteRRA.getTime() > today.getTime())
            cal.addEvent("[pidala.info] Límite queja de " + sujeto, "Fecha límite para emitir una queja sobre la respuesta a la solicitud " + folio + ". El órgano responsable de esta solicitud es " + organo + ".", location, limiteRRA, limiteRRA);

        // Yep, you are allowed to have more than one event in your .ics file
        // cal.addEvent(subject, description, location, begin, end, uid);
        // cal.download(filename, extension, dlh);
        // And you can access the events as javascript objects
        console.log("notifiCal",e,cal);
        if( cal.events().length > 0 ) {
            makeDownload("Eventos "+sujeto+".ics",cal.build());
        }
        else {
            console.log("notifiCal no events");
        }

    });
}

function makeValidDate(invalidDate) {
    let parts = invalidDate.split('/');
    return parts[1] + '/' + parts[0] + '/' + parts[2];
}

function agregarDíasHábilesAFecha(fecha,cantidad) {
    // return cantidad+" días hábiles desde "+fecha;
    if (!fecha) {
        console.log("agregarDíasHábilesAFecha error",fecha,cantidad)
        return;
    }

    let fechaSplit = fecha.split("/");
    let fechaJs = new Date(fechaSplit[1]+"-"+fechaSplit[0]+"-"+fechaSplit[2]);
    let diaMillis = 1 * 1000 * 60 * 60 * 24;
    let undiamas = null;
    while(cantidad > 0) {
        undiamas = new Date(fechaJs.setTime(fechaJs.getTime() + diaMillis))

        //Si es sábado o domingo
        if (undiamas.getDay() == 6 || undiamas.getDay() == 0 || esFeriado(undiamas)) {
        }
        else {
            cantidad --;
        }
    }
    return undiamas.getTime();
}

const feriados = [
    {mes: 0, dia: 1},
    {mes: 1, dia: 6},
    {mes: 2, dia: 20},
    {mes: 4, dia: 1},
    {mes: 8, dia: 16},
    {mes: 10, dia: 20},
    {mes: 11, dia: 25},
];

function esFeriado(dia) {
    for (var f in feriados) {
        if (dia.getMonth() == feriados[f].mes && dia.getDate() == feriados[f].dia) {
            return true;
        }
    }
    return false;
}


function notifOpenPage(e) {
    chrome.runtime.sendMessage({
        type:"pitrack",
        "eventType": "click_notif_open"
    })

    let organo =  $(e.currentTarget).parents(".notificationDetails").find(".notifOrgano").text().trim();
    let folio =  $(e.currentTarget).parents(".notificationDetails").find(".notifFolio").text().split('(')[0].trim();

    console.log("notifDetalles",organo,folio,e);

    let page = window.open("https://www.plataformadetransparencia.org.mx/group/guest/sisai_solicitudes#/historial#?organo="+organo+"&folio="+folio);

}

function notifMarkAllAsRead() {

    chrome.storage.local.get(['pntUserId', 'pntData', 'wixLoginStatus']).then(data => {
        let userData = data.pntData.filter( obj => obj.userId == data.pntUserId ); // Objeto con toda la data del usuario actual
        if (!data.pntUserId) {
            // TODO: mostrar algo temporal si no hay usuario PNT
            return;
        }

        let notifications = userData[0].notificaciones;

        chrome.runtime.sendMessage({
            type:"pitrack",
            "eventType": "click_popup_markALLasread",
            "eventValue": notifications.length
        })

        let folios = [];
        let checked = $(".notificationItem .checkbox input:checked");
        if (checked.length > 0) {
            folios =  checked.parents(".notificationItem").find(".notifFolio").map((index,item)=>{ console.log(item); return item.textContent.split('(')[0].trim() });
        }
        console.log("Mark all as read", checked,checked.parents(".notificationItem").find(".notifFolio"),folios);

        if(notifications.length > 0) {
            notifications.map( notif => {
                if (folios.length == 0 || folios.get().indexOf(notif.dsFolio) > -1) {
                    notif.notifRead = true;
                }

            })
        }

        if ($("#notifMarkSelectedAsRead").is(":visible")) {
            $("#notifMarkAllAsRead,#notifMarkSelectedAsRead").toggle();
        }

        chrome.storage.local.set(data);
        updatePopupBadge(data);
        displayNotifications();
    });

}
function notifFilter() {
    let menu = $('#notifFilterWindow');
    if(!menu.is(':visible')) menu.show();
    else menu.hide();

    $('#notifFilterWindowClose').click(() => {
        menu.hide();
    })
}

function notifToggleRead() {
    showReadNotifications = !showReadNotifications;
    $("#toggleReadBtn").find("input").attr("checked",!showReadNotifications);
    // $("#toggleReadBtn").find(".optionText").text(( showReadNotifications  ?"Ocultar leídas": "Mostrar leídas"))
    displayNotifications();
}

function notifMarkAsUnRead(e) {
    notifMarkAsRead(e,true)
}

function notifMarkAsRead(e,unread=false) {
    chrome.runtime.sendMessage({
        type:"pitrack",
        "eventType": "click_notif_markasread",
        "eventValue": unread?1:0
    })

    let folio =  $(e.currentTarget).parents(".notificationDetails").find(".notifFolio").text().split('(')[0].trim();
    let titulo =  $(e.currentTarget).parents(".notificationDetails").find(".title").text().trim();

    if (!folio && !titulo) {
        console.error("No anduvo archivar",e);
        return;
    }

    // console.log("notifLeida",folio,e);

    chrome.storage.local.get(['pntUserId', 'pntData']).then(data => {
        let userData = data.pntData.filter( obj => obj.userId == data.pntUserId ); // Objeto con toda la data del usuario actual
        if (!data.pntUserId) {
            // TODO: mostrar algo temporal si no hay usuario PNT
            return;
        }

        let notifications = userData[0].notificaciones;
        if(notifications.length > 0) {
            notifications.map( notif => {
                if (notif.dsFolio == folio) {
                    notif.notifRead = !unread;
                }
                if(!folio && titulo == notif.title) {
                    notif.notifRead = !unread;
                }
            })
        }

        // console.log(data);
        chrome.storage.local.set(data);
        updatePopupBadge(data);
        displayNotifications();
        $(e.currentTarget).parents(".notificationDetails").css('border', 'none');
    });


}

function notifToggleEstatus(e) {
    let target = $(e.target);
    console.log(e,target);
    let Estatus = target.parents(".notifToggleEstatus").find("span").text();
    notifFilterItems[Estatus] = !notifFilterItems[Estatus];
    displayNotifications();
}

function gotoOptions() {
    chrome.runtime.sendMessage({
        type:"pitrack",
        "eventType": "click_popup_ajustes"
    })
    setTimeout(()=> {
        chrome.runtime.openOptionsPage();
    }, 100)
}

function gotoLink(url, track) {
    chrome.runtime.sendMessage({
        type:"pitrack",
        "eventType": "click_popup_" + track
    })
    setTimeout(()=> {
        chrome.tabs.create({ url: url });
    }, 100)
}

function popupReady() {
    chrome.runtime.sendMessage({type:"popup_ready"}, function(response) {
        // console.log('popup_ready response', response);
        if(response.email) {
            $('#pntEmail').text(response.email);
        }
    });
}

let refreshing = false;
function actualizarStats() {
    if(refreshing) return;
    chrome.runtime.sendMessage({type:"refresh_stats"}, function(response) { });
    refreshing = true;
    $('#refreshText').addClass('disabled');
    $('#spinnerImg').addClass('rotate');
    $('#stats').addClass('refreshing');

}

function initPopup(botonesMapeo) {
    Object.keys(botonesMapeo).forEach((btnId) => {
        // console.log(btnId);
        botones[btnId] = document.getElementById(btnId);
        botones[btnId].addEventListener("click", botonesMapeo[btnId]);
    });

    chrome.storage.local.get(['pntData', 'pntUserId']).then((data) => {
        // console.log('initPopup', data);
        if(!data.pntUserId){ // Si no se puede determinar el usuario actual (no ha hecho login en la PNT)
            let msg = `Accede a la Plataforma Nacional de Transparencia para reanudar las notificaciones de pidala.info.
            <button class="popupBtn" id="pntLoginBtn">Acceder a PNT</button>
            <br>
            <br>
            <span class="email">Pidala.info no guarda tu contraseña de la PNT.</span>`;
            $('#summaryTitle').hide();
            $('#stats').html('<div class="pntLoginMsg">' + msg + '</div>');
            $("#pntLoginBtn").on("click", ()=>{ window.open("https://www.plataformadetransparencia.org.mx/web/guest/home?p_p_id=com_liferay_login_web_portlet_LoginPortlet&p_p_lifecycle=0&p_p_state=maximized&p_p_mode=view&saveLastPath=false&_com_liferay_login_web_portlet_LoginPortlet_mvcRenderCommandName=%2Flogin%2Flogin") })

        }

        else { // Hay un usuario de la PNT y tiene sesión iniciada
            if (data.pntData) {
                let userData = data.pntData.filter( obj => obj.userId == data.pntUserId ); // Objeto con toda la data del usuario actual
                // console.log("userData",userData);
                if (userData.length > 0){ // Si ya hay data del usuario actual en local storage
                    updateStats(userData[0].statuses);
                }
                else updateStats(); // Hay login, pero el usuario no tiene data en el historial
            }
            else { // No hay nada en local storage, primera vez que se usa la extensión
                updateStats();
            }
        }

        popupReady();
    });
    setTimeout(createWixLoginIframe,10);
    updateUserInfo();
}

//Actualizar interfaz
function updateUserInfo() {
    chrome.storage.local.get("wixLoginStatus").then(data => {
        if(!data.wixLoginStatus)    disableMemberActions();
        else                        enableMemberActions();

        if (!isLoggedInPNT) {
            $('#notificationBtn').hide();
        }

    })


    chrome.storage.local.get(["wixEmail", "wixUserId","wixNickname","wixAvatar", "wixPlanName"]).then(data => {
        if (data.wixEmail) {
            $('#userEmail').text(data.wixEmail);
        }
        if (data.wixPlanName) {
            $('#userPlan').append("Plan "+data.wixPlanName);
        }


        if (data.wixUserId && data.wixNickname) {
            $('#userName').text(data.wixNickname);
            if(data.wixAvatar) $('#userAvatar').css('background-image', 'url("' + data.wixAvatar + '")');
            else $('#userInitial').text(data.wixNickname.substr(0, 1)).show();
            $('#loginArea').hide();
            $('#userArea').show();
        }
        else {
            // console.error("showUserInfo", "No info", data);
            $('#userArea').hide();
            $('#loginArea').show();
        }
    })
}

function disableMemberActions() {
    $('.contentPanel .onlineContent').hide();
    $('.contentPanel .offlineContent').show();
    $('#notificationBtn').hide();
}

function enableMemberActions() {
    $('.contentPanel .offlineContent').hide();
    $('.contentPanel .onlineContent').show();
    $('#notificationBtn').show();
}

function updateStats(data) {
    $('#stats').text("Envía tu primer solicitud");
    $('#summaryTitle').show();
    if (!data) { return false }
    let statsHtml = '';
    Object.keys(data).map(status => {
        statsHtml +=    "<div class=\"pntStatusContainer\">" +
                            "<div class=\"pntStatusNum\">" + data[status] + "</div>" +
                            "<div class=\"pntStatusText\">" + status + "</div>" +
                        "</div>";

    });
    $('#stats').html(statsHtml);
}

// descargarSujetos();
// Proceso para actualizar sujetos obligados en PNT Plus
async function descargarSujetos(e) {
    let organos = [];
    let promisessujetos = [];

    //Iterar todos los organos (estados)
    for (let idOrgano = 1; idOrgano < 34; idOrgano++) {

        //Pedir el listado de sujetos ese organo
        await fetch("https://www.plataformadetransparencia.org.mx/group/guest/sisai_solicitudes?p_p_id=mx_org_inai_solicitudes_Sisai_solicitudesPortlet_INSTANCE_rrViImewRTML&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=%2Finai%2Fsolicitudes%2FselectSujetosObligados&p_p_cacheability=cacheLevelPage&"+idOrgano, {
            "body": "{\"idOrganoGarante\":" + idOrgano + "}",
            "method": "POST",
            "mode": "cors",
            // headers: {organo: idOrgano}
        }).then(res => {
            if (!organos) {
                //Hubo un error antes
                return;
            }
            // Pedir json de las respuestas
            let organojson = res.json();
            organos.push(organojson);

            //Verificar si la respuesta vino completa
            //Si alguna falló, cancelar todo.
            organojson.then(json => {
                if (json.listFederadoTcSujetoObligado[0]) {
                    console.log("Listo", json.listFederadoTcSujetoObligado[0].federadoTcOrganoGarante.siglas, json.listFederadoTcSujetoObligado.length);
                } else {
                    organos = null;
                    promisessujetos = null;

                    console.error("Error! Es posible que el listado no esté completo, vuelva a intentarlo.", res, json)
                    throw(new Error("Error! Es posible que el listado no esté completo, vuelva a intentarlo."))
                }
            }).catch(e => {
                console.error(e);
                promise = null;
                organos= null;
            })
        }).catch(e => {
            console.error(e);
            promise = null;
            organos= null;
        })
        if (!organos) {
            break;
        }
        //Cargar todas las promesas
        // promisessujetos.push(promise);
    }

    //Esperar a que se complete el proceso
    // Promise.all(promisessujetos).then(() => {
        Promise.all(organos).then(async (sujetos) => {
            console.log("Se resolvieron sujetos obligados:",organos);

            //Unificar los sujetos de cada estado en un mismo listado
            let allsujetos = [];
            for (let su in sujetos) {
                //Filtrar sólo campos requeridos
                let scs = sujetos[su].listFederadoTcSujetoObligado.map(s => {
                    let sc = { federadoTcOrganoGarante: {} };
                    sc.federadoTcOrganoGarante.idOrganoGarante = s.federadoTcOrganoGarante.idOrganoGarante;
                    sc.federadoTcOrganoGarante.dsNombre = s.federadoTcOrganoGarante.dsNombre
                    sc.federadoTcOrganoGarante.siglas = s.federadoTcOrganoGarante.siglas
                    sc.federadoTcOrganoGarante.siglasog = s.federadoTcOrganoGarante.siglasog
                    sc.dsNombre = s.dsNombre;
                    sc.idSujetoObligado = s.idSujetoObligado
                    sc.domicilio = s.domicilio;
                    sc.urlportal = s.urlportal;
                    sc.responsable = s.responsable;
                    sc.correo = s.correo;
                    sc.telefono = s.telefono;
                    sc.nombrecorto = s.nombrecorto;
                    return sc;
                })

                allsujetos = allsujetos.concat([], scs);
            }

            //Mostrar el listado por consola para copiarlo
            sujetosexport.sujetos = allsujetos;
            console.log(sujetosexport);
            makeDownload("Sujetos.json", JSON.stringify(sujetosexport));
            // botones.btnGenerar.textContent = botones.btnGenerar.original;
        }).catch(e => {
            console.error("No se pudieron procesar todos los estados",e);
            alert("Error exportando sujetos");
            // botones.btnGenerar.textContent = botones.btnGenerar.original;
        });
    // })

}


function getCSVHeaders(data) {
    const headers  = [
        "Estatus",
        "Folio",
        "Órgano Garante",
        "Sujeto Obligado",
        "Fecha última actividad",
        "Última actividad",
        "Límite",
        "Recepción",
        "Fecha límite para RIA",
        "Fecha límite para RRA",
        "Situación",
        "URL Historial PNT",
        "Pregunta",
        "Otros datos",
        "Respuesta",
        "Nombre adjunto 1",
        "idAdjunto1",
        "Nombre adjunto 2",
        "idAdjunto2",
        "URL Descarga PNT",
        "idRespuesta",
        "dsSolicitud",
        "dtFechaLimiteRegistroMi",
        "fgCandidataMi",
        "idEstatus",
        "idOrganoGarante",
        "idSolicitudDependencia",
        "semaforo",
        "sigemiRegistro",
        "tipoSolicitud",
        "dsMedioEntrada",
        "dsModalidadEntrega",
        "dtFechaLimiteQueja",
        "acuseRespuestaSolicitante",
        "acuseRespuestaUT",
        "dsLugarDeEntrega",
        "dtFechaEntregaInformacion",
        "dtFechaRespuestaSolicitante",
        "fechaLimitePago",
        "idReciboPago",
        "idTipoSolicitud",
        "lstSoCanalizacion",
        "otraModalidadEntrega",
        ]
    return '"'+headers.join('","')+"\"\n";
}
function getCSVData(data) {
    let csv = "";

    for (let d in data) {
        let s = data[d];
        s.situacion = calcularSituacion(s.semaforo);

        let csvArray = [
            s.dsEstatus.trim(),
            s.dsFolio.trim(),
            s.dsOrganoGarante.trim(),
            s.dsSujetoObligado.trim(),
            s.dtFechaUltimaResp,
            s.dsUltimaActividad.trim(),
            s.dtLimite.trim(),
            s.dtRecepcion.trim(),
            s.fechaMaximaRia ? new Date(s.fechaMaximaRia).toLocaleDateString() : "",
            s.fechaMaximaRra ? new Date(s.fechaMaximaRra).toLocaleDateString() : "",
            s.situacion.trim(),
            "https://www.plataformadetransparencia.org.mx/group/guest/sisai_solicitudes#/historial#?organo="+encodeURIComponent(s.dsOrganoGarante.trim())+"&folio="+s.dsFolio.trim(),
            (s.dsPregunta) ? s.dsPregunta.replace(/\"/g,"'").trim() : "",
            (s.otrosDatos) ? s.otrosDatos.replace(/\"/g,"'").trim() : "",
            (s.dsRespuesta) ? s.dsRespuesta.replace(/\"/g,"'").trim() : "",
            s.listAdjuntosRespuesta[0] ? s.listAdjuntosRespuesta[0].dsNombre.trim() : "",
            s.listAdjuntosRespuesta[0] ? s.listAdjuntosRespuesta[0].idAdjunto : "",
            s.listAdjuntosRespuesta[1] ? s.listAdjuntosRespuesta[1].dsNombre.trim() : "",
            s.listAdjuntosRespuesta[1] ? s.listAdjuntosRespuesta[1].idAdjunto : "",
            (s.listAdjuntosRespuesta[0] || s.listAdjuntosRespuesta[1]) ? "https://www.plataformadetransparencia.org.mx/group/guest/sisai_solicitudes#/historial#?organo="+encodeURIComponent(s.dsOrganoGarante.trim())+"&folio="+s.dsFolio.trim()+"&descargaAdjuntos=1" : "",
            s.idRespuesta,
            s.dsSolicitud.trim(),
            s.dtFechaLimiteRegistroMi,
            s.fgCandidataMi,
            s.idEstatus,
            s.idOrganoGarante,
            s.idSolicitudDependencia,
            s.semaforo.trim(),
            s.sigemiRegistro,
            s.tipoSolicitud.trim(),
            s.dsMedioEntrada.trim(),
            s.dsModalidadEntrega.trim(),
            s.dtFechaLimiteQueja,
            s.acuseRespuestaSolicitante,
            s.acuseRespuestaUT,
            s.dsLugarDeEntrega,
            s.dtFechaEntregaInformacion,
            s.tFechaRespuestaSolicitante,
            s.fechaLimitePago,
            s.idReciboPago,
            s.idTipoSolicitud,
            s.lstSoCanalizacion && s.lstSoCanalizacion.length > 0 ? s.lstSoCanalizacion.join("|").replace(/[\n|\,]/g,"") : "",
            s.otraModalidadEntrega
        ]
        // console.log(s);
        // console.log(data);

        //Generar CSV
        csv += '"'+csvArray.join('","')+"\"\n";
    }
    return csv;
}

function calcularSituacion(dot) {
    switch (dot) {
        case "dotRed":
            return "Fuera de tiempo";
        case "dotYellow":
            return "En alerta"
        case "dotGreen":
            return "En tiempo";
        default:
            return "Desechada";
    }
}

async function guardarSolicitudes() {
    //guardar
    chrome.runtime.sendMessage({
        type:"pitrack",
        "eventType": "click_popup_exportar"
    })

    chrome.storage.local.get(['pntUserId', 'pntData']).then(data => {
        if (!data.pntUserId) return;

        let userData = data.pntData.filter( obj => obj.userId == data.pntUserId ); // Objeto con toda la data del usuario actual
        if(userData.length == 0) {
            console.error("POPUP guardarSolicitudes","No pntData for",data.pntUserId)
            return;
        }

        console.log("guardarSolicitudes", userData[0].historial)
        if (!userData[0].historial || userData[0].historial.length == 0) {
            console.error("guardarSolicitudes","Aún no se ha sincronizado el historial.")
            return;
        }

        // Create the blob URL.
        let csv = getCSVHeaders(userData[0].historial);
        csv += getCSVData(userData[0].historial);

        makeDownload("Solicitudes.csv",csv);
    });
}

function makeDownload(filename,text) {
    const BOM = new Uint8Array([0xEF,0xBB,0xBF]);
    const blobURL = URL.createObjectURL(new Blob([BOM,text]),{encoding:"UTF-8",type:"text/plain;charset=UTF-8"});

    // const blobURL = URL.createObjectURL(new Blob([text]));
    // Create the `<a download>` element and append it invisibly.
    const a = document.createElement('a');
    a.href = blobURL;
    const date = new Date();
    a.download = "[pidala_info] "+date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate()+" "+filename;
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


//Iniciar sesion en WIX de PidaLa.info
let wixLoginIframe;
function createWixLoginIframe() {
    wixLoginIframe = document.createElement("iframe");
    wixLoginIframe.id = "wixLogin";
    wixLoginIframe.height = 1;
    wixLoginIframe.width = 1;
    wixLoginIframe.frameborder = 0;
    // wixLoginIframe.src="https://www.pidala.info/check-login";
    document.getElementById("loginArea").parentNode.appendChild(wixLoginIframe)

    //Escuchar comunicación del iframe de wix
    window.addEventListener("message", event => {
        // console.log("wixWindow message",event);
        let message = event.data;
        switch (message.origin) {
            case "Login":
                $("#loginRefresh").hide();


                let member = message.member;
                // console.log("wixLogin",message);
                if (member.hasOwnProperty("_id")) {
                    chrome.storage.local.set({
                        "wixLoginStatus": true,
                        "wixUserId": member._id,
                        "wixNickname": member.profile.nickname,
                        "wixAvatar": member.profile.profilePhoto ? member.profile.profilePhoto.url : "",
                        "wixEmail": member.loginEmail
                    })
                    isLoggedInWix = true;
                }
                else {
                    chrome.storage.local.set({
                        "wixLoginStatus": false,
                        "wixUserId": null,
                        "wixNickname": "",
                        "wixAvatar": "",
                        "wixEmail": ""
                    })
                    isLoggedInWix = false;
                }
                wixLoginIframe.style.display = "none";
                updateUserInfo();
                break;
            case "pntUptime":
                // console.log("setUptime",message);
                setUptime(message.status);
        }
    } );
}

function setUptime(status) {
    chrome.storage.local.set({"pntuptime": status });
    updateUptimeFromLocalStorage(status);

}

function updateUptimeFromLocalStorage() {
    chrome.storage.local.get("pntuptime").then((data) => {
        // console.log("updateUptimeFromLocalStorage",data);
        document.getElementById("statusIconMex").src = data.pntuptime == "up" ? "../images/online.png" : "../images/offline.png";
        });
}


function iniciarSesion() {
    wixLoginIframe.src="https://www.pidala.info/login-v113";
    wixLoginIframe.style.display = "block";

    chrome.runtime.sendMessage({
        type:"pitrack",
        "eventType": "click_popup_login"
    })
}

function cerrarSesion() {
    // console.log("popup logout")
    wixLoginIframe.src="https://www.pidala.info/logout";

    chrome.runtime.sendMessage({
        type:"pitrack",
        "eventType": "click_popup_logout"
    })

    $("#loginRefresh").show();

}

function isHidden(elem) {
    const styles = window.getComputedStyle(elem);
    return styles.display === 'none' || styles.visibility === 'hidden'
}

function restoreRefreshInterface() {
    // Restore refresh button text
    refreshing = false;
    $('#refreshText').removeClass('disabled');
    $('#spinnerImg').removeClass('rotate');
    $('#stats').removeClass('refreshing');
}

let pnt_send_notification = null;
//This is for communication with popup
chrome.runtime.onMessage.addListener(function (request, origin, cb) {
    // console.log('popup runtime onMessage',request, origin, cb);
    switch (request.type) {
        case 'refresh_complete':
            restoreRefreshInterface();
            chrome.storage.local.get(["pntData", 'pntUserId']).then((data) => {
                let userData = data.pntData.filter( obj => obj.userId == data.pntUserId ); // Objeto con toda la data del usuario actual
                updateStats(userData[0].statuses);
            });
            break;
        case 'refresh_failed':
            let msg = '';
            switch(request.reason) {
                case 'session_expired':
                    chrome.storage.local.remove(['pntUserId','pntUserEmail']);
                    chrome.action.setIcon({ path: '../images/icon-32.png' });
                    msg = 'Accede a la Plataforma Nacional de Transparencia para reanudar las notificaciones de pidala.info. <button id="pntLoginBtn">Acceder a PNT</button>';
                    $('#stats').html('<div class="pntErrorMsg">' + msg + '</div>');
                    $("#pntLoginBtn").on("click", ()=>{ window.open("https://www.plataformadetransparencia.org.mx/web/guest/home?p_p_id=com_liferay_login_web_portlet_LoginPortlet&p_p_lifecycle=0&p_p_state=maximized&p_p_mode=view&saveLastPath=false&_com_liferay_login_web_portlet_LoginPortlet_mvcRenderCommandName=%2Flogin%2Flogin") })
                    break;
            }
            restoreRefreshInterface();
            break;
    }
});
