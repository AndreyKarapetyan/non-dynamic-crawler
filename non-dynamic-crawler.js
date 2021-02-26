var got = require("got");
var cheerio = require("cheerio"); // please install these 2 packages before executing the code
((website) => { // let us not pollute global namespace and pass the website to our immediately invoked function
	var normalize = (str) => { // a function to make our string without spaces at the beginning and end, without '/' at the end, and without www
		str = str.trim();      // without '/' at the end, and without www
		if(str.endsWith('/'))
			str = str.substring(0, str.length - 1);
		if(str.includes('www.'))
			str = str.split('www.')[0] + str.split('www.')[1];
		return str;
	}
	website = normalize(website);
	var url = new URL(website); // will be helpful to parse it
	var sCodes = []; // will contain all our status codes, for unknown reasons it will be 200 and 999 only
	var nCodes = []; // the number of cases of each status code
	var arr = [website]; // will contain urls to which we should go and
	var arrofhost = [url.hostname]; // accordingly this will contain all necessary hostnames
	var queue = [website]; // we use queue data structure because... recursions cause headache
	var arrofurls = []; // will contain all hashes and not-same-hostname websites
	var checkAdd = (stat) => { // a function to add the necessary status code if it doesn't exist or increment the number of cases
		if(sCodes.includes(stat))
			nCodes[sCodes.indexOf(stat)]++;
		else {
			sCodes.push(stat);
			nCodes.push(1);
		}
	}
	var findAll = async (site) => {
		loop:while(queue.length > 0) {
			var q = queue[0]; // select the first
			var response;
			var url = new URL(q);
			try {
				var shifted = queue.shift(); // every time the first one is deleted
				response = await got(shifted, {timeout: 60000}); // send a request with 1 minute timeout
				var sc = response.statusCode;
				checkAdd(sc); // and if the response is okay, increment
			}
			catch(e) { // if the response is not okay it means we cannot crawl that site, and the according status code is 999
				console.log(`${q}, 999`);
				checkAdd(999);	
				continue loop; // go to the beginning of the loop
			}
			var origin = url.origin; // every time we are on a page we want to have the origin to append it below
			console.log(`${q}, ${response.statusCode}`);
			var $ = cheerio.load(response.body); // parse the dom with server-side jquery
			var a = []; // will store links
			$('a').each(function() { // get all hrefs on the page
				var href = $(this).attr("href");
				if(href && !href.includes('javascript:') && !href.includes('mailto:') && !href.includes('tel:'))
					a.push(href); // we need only usual links
			})
			for(let i = 0; i < a.length; i++) {
				a[i] = normalize(a[i]); // make the string normal
				try {
					var v = new URL(a[i]); // check whether we can make a normal url out of that string
				}
				catch(e) { // if not, it is propably a relative path
					if(!a[i] || a[i].startsWith("/") || a[i].startsWith("#"))// if it is a hash or empty or '/', add the origin
						a[i] = origin + a[i];
					else
						a[i] = origin + '/' + a[i];
					a[i] = normalize(a[i]); // na vsyaki
				}
			}
			for(let i = 0; i < a.length; i++) {
				var u = new URL(a[i]);
				var hName = u.hostname; // resources.hexometer.com, hexometer.com, dash.hexometer.com
				if(arrofhost.some((v) => v.includes(hName) || hName.includes(v))) { // we should go to all
					if(!arrofhost.includes(hName)) { // no duplicates
						arrofhost.push(hName);
					}
					if(u.origin === origin && a[i].includes('#')) { // if there is a hash on the current page, we don't go
						if(!arrofurls.includes(a[i])) // no duplicates
							arrofurls.push(a[i]);
					}
					else {
						if(!arr.includes(a[i])) { // no duplicates
							arr.push(a[i]);
							queue.push(a[i]); // we must go to the page
						}
					}
				}
				else {
					if(!arrofurls.includes(a[i]))
						arrofurls.push(a[i]); // so, arrofurls will contain all links to which we shouldn't go, 
				}
			}
		}
	}
	findAll(website).then(() => {
		var p = []; // will be an array of promises
		for(let i = 0, len = arrofurls.length; i < arrofurls.length; i++)
			p.push(got((arrofurls[i]), {method: "HEAD", timeout: 60000})); // send a request for headers only, we don't need the body
		Promise.allSettled(p).then((resArr) => { // the method returns an array of objects
			for(let i = 0, len = arrofurls.length; i < arrofurls.length; i++) {
				if(resArr[i].status === "fulfilled") { // the status property indicates whether the promise is resolved or rejected
					checkAdd(resArr[i].value.statusCode);
					console.log(`${arrofurls[i]}, ${resArr[i].value.statusCode}`);
				}
				else {
					checkAdd(999);
					console.log(`${arrofurls[i]}, 999`);
				}
			}
		}).then(() => {
			for(let j = 0; j < sCodes.length; j++)
				console.log(`${sCodes[j]} --> ${nCodes[j]}`); // in the end, let's see how many urls there were with each status code
		}).catch((e) => console.log("Everything has gone to hell!!!")); // THIS WILL NEVER PRINT		
	}).then();
})("https://myjob.am");