// first we require all the asscoiated libraries
// node ipl.js --excel=ipl.csv --dataDir=ipl --source=https://www.espncricinfo.com/series/ipl-2019-1165643/match-results
let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let path = require("path");
let excel = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");

// convert matches to teams
// save teams to excel using excel4node
// create folders and save pdf using pdf-lib

let args = minimist(process.argv);

// browser se html lena hai
let responsekapromise = axios.get(args.source);
responsekapromise.then(function(response){
    let html = response.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;

    let matchscoredivs = document.querySelectorAll("div.match-score-block");
    let matches  = [];
    for(let i = 0 ; i<matchscoredivs.length;i++){
        let match = {
            t1: "",
            t2: "",
            t1s: "",
            t2s: "",
            result: ""
        };

        let tp = matchscoredivs[i].querySelectorAll("div.name-detail > p.name");
        match.t1 = tp[0].textContent;
        match.t2 = tp[1].textContent;

        let scorespans = matchscoredivs[i].querySelectorAll("div.score-detail > span.score");
        if(scorespans.length==2){
            match.t1s = scorespans[0].textContent;
            match.t2s = scorespans[1].textContent;
        }
        else if(scorespans.length==1){
            match.t1s=scorespans[0].length.textContent;
            match.t2s = "";
        }
        else{
            match.t1s = "";
            match.t2s = "";
        }
        let resultspan = matchscoredivs[i].querySelector("div.status-text > span");
        match.result = resultspan.textContent;

        matches.push(match);

    }
    let matcheskaJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json",matcheskaJSON,"utf-8");

    let teams = [];
    for(let i = 0; i<matches.length;i++){
        addteamtoteamarrayifnotalreadythere(teams,matches[i].t1);
        addteamtoteamarrayifnotalreadythere(teams,matches[i].t2);
    }

    for (let i = 0; i < matches.length; i++) {
        addmatchtospecificteam(teams, matches[i].t1, matches[i].t2, matches[i].t1s, matches[i].t2s, matches[i].result);
        addmatchtospecificteam(teams, matches[i].t2, matches[i].t1, matches[i].t2s, matches[i].t1s, matches[i].result);
    }

    let teamskaJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamskaJSON, "utf-8");

    prepareexcel(teams, args.excel);
    preparefolderandpdf(teams,args.dataDir);

    

})

function preparefolderandpdf(teams,dataDir){
    if(fs.existsSync(dataDir) == true){
        fs.rmdirSync(dataDir,{ recursive: true });
    }

    fs.mkdirSync(dataDir);

    for (let i = 0; i < teams.length; i++) {
        let teamFN = path.join(dataDir, teams[i].name);
        fs.mkdirSync(teamFN);

        for (let j = 0; j < teams[i].matches.length; j++) {
            let match = teams[i].matches[j];
            creatematchscorecardpdf(teamFN, teams[i].name, match);
        }
    }

}

function creatematchscorecardpdf(teamFN,hometeam,match){
    let matchFN = path.join(teamFN,match.vs);

    let templatefilebytes = fs.readFileSync("Template.pdf");
    let pdfdockapromise = pdf.PDFDocument.load(templatefilebytes);
    pdfdockapromise.then(function(pdfdoc){
        let page = pdfdoc.getPage(0);
        page.drawText(hometeam, {
            x: 320,
            y: 703,
            size: 8
        });
        page.drawText(match.vs, {
            x: 320,
            y: 688,
            size: 8
        });
        page.drawText(match.selfScore, {
            x: 320,
            y: 673,
            size: 8
        });
        page.drawText(match.oppScore, {
            x: 320,
            y: 658,
            size: 8
        });
        page.drawText(match.result, {
            x: 320,
            y: 646,
            size: 8
        });

        let changebyteskapromise = pdfdoc.save();
        changebyteskapromise.then(function(changedbytes){
            if(fs.existsSync(matchFN + ".pdf") == true){
                fs.writeFileSync(matchFN + "1.pdf",changedbytes);
            }
            else{
                fs.writeFileSync(matchFN + ".pdf",changedbytes);
            }
        })

    })

}

function prepareexcel(teams, excelfilename) {
    let wb = new excel.Workbook();

    for (let i = 0; i < teams.length; i++) {
        let tsheet = wb.addWorksheet(teams[i].name);

        tsheet.cell(1, 1).string("Vs");
        tsheet.cell(1, 2).string("Self Score");
        tsheet.cell(1, 3).string("Opp Score");
        tsheet.cell(1, 4).string("Result");
        for (let j = 0; j < teams[i].matches.length; j++) {
            tsheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
            tsheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
            tsheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore);
            tsheet.cell(2 + j, 4).string(teams[i].matches[j].result);
        }
    }

    wb.write(excelfilename);
}





function addteamtoteamarrayifnotalreadythere(teams,teamname){
    let tidx = -1 ;
    for(let i = 0 ; i<teams.length;i++){
        if(teams[i].name==teamname){
            tidx = i;
            break;

        }

    }
    if(tidx==-1){
        teams.push({
            name : teamname,
            matches : []
        })
    }
}
function addmatchtospecificteam(teams , hometeam , oppteam,selfscore,oppscore,result){
    let tidx = -1 ;
    for(let i = 0 ; i<teams.length;i++){
        if(teams[i].name==hometeam){
            tidx = i;
            break;

        }
    }
    let team = teams[tidx];
    team.matches.push({
        vs : oppteam,
        selfScore: selfscore,
        oppScore : oppscore,
        result: result
    })


}
