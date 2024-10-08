const dataRequester = require("./pnt-data-requester");
const http = require("http");
const host = 'localhost';
const port = process.env.PORT || 16132;

const requestListener = async function (req, res) {
    res.setHeader("Content-Type", "application/json");

    try {
        let url = new URL(req.url, "http://localhost");
        // console.log(url.searchParams);
        switch (url.pathname) {
            case "/requestData":
                result = await requestData();
                res.writeHead(200);
                res.end(JSON.stringify(result));
                break
            case "/downloadFile":
                console.log('--- INITIATING FILE DOWNLOAD REQUEST ---');
                result = await downloadFile(url.searchParams.get("src"),url.searchParams.get("dest"),url.searchParams.get("filename"),url.searchParams.get("datadir"));
                if(result.status == 'completed')
                    res.writeHead(200);
                else
                    res.writeHead(555);
                res.end(JSON.stringify(result));
                break
            default:
                res.writeHead(404);
                res.end(`{"error": "Not found"}`);
        }
    }
    catch(e) {
        console.log("PDS: error in controller",e);
        res.writeHead(500);
        res.end(`{"error": ${JSON.stringify(e)}}`);

    }

    return false;
};


const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});


function requestData() {
    console.log("Request Data");
    try {
        return dataRequester.request_pnt_data();
    }
    catch(e) {
        return e;
    }
}


function downloadFile(src,dest,filename,datadir) {
    console.log("downloadFile",src,dest,filename,datadir);
    try {
        // return 1
        return dataRequester.download_file(src,dest,filename,datadir);
        // return dataRequester.request_pnt_data();
    }
    catch(e) {
        return e;
    }
}
