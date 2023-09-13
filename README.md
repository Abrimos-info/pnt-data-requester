# Pidala.info - PNT-data-requester

Extensión de Chrome y script para NiFi que permite solicitar la descarga de los datos abiertos y monitorear que se haga todos los días de la Plataforma Nacional de Transparencia (PNT) de México. Un subproyecto de [Pidala.info](https://pidala.info/)

## Instalación
1. git clone
1. npm install

### Ejecución

Se configura con variables de entorno al correr.

### Variables necesarias:
- DISPLAY=:1
- CHROME_DATADIR=/path/to/pnt-data-requester/datadir
- CHROME_EXTENSION_PATH=/path/to/pnt-data-requester/extension
- PIDALA_MAIL_ADDRESS="pntpidala@mailcatch.com";

### Variables opcionales:
- STARTING_URL='https://www.plataformadetransparencia.org.mx/web/guest/datos_abiertos'
- CHROME_PATH="google-chrome"
- CHROME_PORT=37195
- CHROME_DOWNLOAD_PATH=__dirname+"/downloads"

Ejemplo:
`DISPLAY=:1 PIDALA_MAIL_ADDRESS="pntpidala@mailcatch.com" CHROME_DATADIR=$PWD/datadir CHROME_EXTENSION_PATH=$PDW/extension node pnt-data-requester.js`

## Pendientes:
- CHROME_PROXY = "";
- Automatizar el click