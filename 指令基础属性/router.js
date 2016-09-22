var express = require('express');
var http = require('http');
var cheerio = require('cheerio');
var fs = require('fs');
var mpath = require('path');
var router = express.Router();

var cachePath = "cache/"
var userAgent = "Mozilla/4.0 (compatible; MSIE 0; AllDataSheetFinder)";
router.route('/datasheet').post(function(req, res) {
	console.log(req.connection.remoteAddress);
	search(req.body.searchWord,1,function(resultTable,resultTitle,total,pageCount){
		res.json({'resultTitle':resultTitle,'resultTable':resultTable,'total':total,'pageCount':pageCount,'pageNumber':1});
	});
});

router.route('/page/:id').get(function(req, res) {
	search(req.query.searchWord,req.query.pageNumber,function(resultTable,resultTitle,total,pageCount,pageNumber){
		res.json({'resultTitle':resultTitle,'resultTable':resultTable,'total':total,'pageCount':pageCount,'pageNumber':pageNumber});
	});
});

router.route('/datasheet').get(function(req, res) {
	var filePath = cachePath + req.query.fileName;
	if(!fs.existsSync('public/'+filePath)) {
		getDownloadPath(req.query.url,function(path,referer,cookie){
			download(req.query.fileName,path,referer,cookie,function(){
				res.send(filePath);
				 console.log(filePath);
			});
		});
	}else {
		res.send(filePath);
	}
	
});


function search(searchWord,pageNumber,callback){
	var options = {};
	if(pageNumber==1){
		options = {
			host: "www.alldatasheet.com",
			path: "/view_datasheet.jsp?Searchword="+searchWord+"&sPage="+pageNumber+"&sField=1"
		};  
	}else{
		options = {
			host: "www.alldatasheet.com",
			path: "/view_datasheet.jsp?Searchword="+searchWord+"&sPage="+pageNumber+"&sField=1",
			headers: {
				 'User-Agent': "Mozilla/4.0 (compatible; MSIE 0; AllDataSheetFinder)",
				 'Referer': "http://www.alldatasheet.com/view_datasheet.jsp?Searchword="+searchWord+"&sPage=1&sField=1",
			}
		};  
	}
 

	http.get(options, function(res) {
		var resultTitle = [];
		var resultTable = [];
		var resultContent = "";
		res.on("data", function(data) {
			resultContent+=data;
		});
		
		res.on("end", function() {
			$ = cheerio.load(resultContent);
			
			//获取结果的页数和当前页 find('font').eq(2).html().replace(/[^0-9]/g,'')
			var resultInfo = $('.main').eq(4).find('td');
			var total = parseInt(resultInfo.find('font').eq(2).text());
			var pageCount = parseInt(resultInfo.text().slice(resultInfo.text().lastIndexOf('/')+1,resultInfo.text().lastIndexOf('Page')-1));//'page'前面有一个空格
			//获取结果的表标题
			for(var i=0; i<4; i++) {
				resultTitle[i] = $('.main').eq(5).find('tr').eq(0).find('td').eq(i).text();
			}
			
			//获取结果的表中的每一行
			var resultCount = $('.main').eq(5).find('tr').length;
			
			for(var i=1; i<resultCount; i++) {
				var resultRow = {};
				var element = $('.main').eq(5).find('tr').eq(i);
				
				if(element.find('td').length==3){
					resultRow.partNo = element.find('td').eq(0).find('a').text();
					resultRow.datasheetUrl = element.find('td').eq(1).find('a').attr('href');
					var descs = element.find('td').eq(2).find('a');
					resultRow.desc = getDesc(descs);
				}else if(element.find('td').length==4) {
					resultRow.imgUrl = element.find('td').eq(0).find('img').attr('src');
					resultRow.manufacturer = element.find('td').eq(0).find('img').attr('alt');
					resultRow.partNo = element.find('td').eq(1).find('a').text();
					resultRow.datasheetUrl = element.find('td').eq(2).find('a').attr('href');
					var descs = element.find('td').eq(3).find('a');
					resultRow.desc = getDesc(descs);
				}

				function getDesc(descs){
					var desc = descs.eq(0).html();
					for(var r = 1; r < descs.length-1; r++) {
						desc = desc +' '+descs.eq(r).html();
					}
					return desc;
				}
			
				resultTable.push(resultRow);
			}
			callback(resultTable,resultTitle,total,pageCount,pageNumber);
		});

	}).on('error', function(e) {
		console.log("Got error: " + e.message);
	});
	
}

function getDownloadPath(orginUrl,callback) {
	orginPath = orginUrl.replace("http://www.alldatasheet.com","");
	paths = orginPath.replace("datasheet-pdf/pdf","datasheet-pdf/view");
	referer = "http://www.alldatasheet.com"+orginPath;
	var options = {
		'host': "pdf1.alldatasheet.com",
		'path': paths,
		headers: {
			'User-Agent': userAgent,
			'Referer': referer
		}
	};   
	
	http.get(options, function(res){
		var resultContent = "";
		res.on("data", function(data) {
			resultContent+=data;
		});
		res.on("end", function() {
			$ = cheerio.load(resultContent);
			cookie = res.headers['set-cookie'].toString().replace(/,/g,';');
			callback($('iframe').eq(2).attr('src'),referer,cookie);
		});
		
	}).on('error', function(e) {
		console.log("Got error: " + e.message);
	});
}

function download(fileName,path,referer,cookie,callback) {
	var options = {
		host:"pdf1.alldatasheet.com",
		path:path,
		headers: {
			'User-Agent': userAgent,
			'Referer': referer,
			'Cookie': cookie
		}
	}

	http.get(options, function(res){
		var size = 0;
		var chunks = [];
		res.on("data", function(chunk) {
			size += chunk.length;
			chunks.push(chunk);
		});
		res.on("end", function(data) {
			
			var data = Buffer.concat(chunks, size);

			fs.writeFile(mpath.join(__dirname, "public/cache/"+fileName), data, function (err) {
				if (err) throw err;
				callback(fileName);
			});
		});
	}).on('error', function(e) {
		console.log("Got error: " + e.message);
	});
}

module.exports = router;