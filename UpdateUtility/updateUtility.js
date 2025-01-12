fs = require("fs")
path = require("path")
os = require("os")
database = require("../Controllers/database.json")
require("./mediaElements")
require("dotenv").config({ path: path.join(__dirname, "./.env") });

const { execSync, spawnSync } = require('child_process');
const { XMLParser, XMLBuilder } = require("fast-xml-parser")
const { Resvg } = require('@resvg/resvg-js')
const readline = require("readline")

let appdataPath = process.env.APPDATA
if (os.platform() === "win32") {
	appdataPath = process.env.APPDATA
} else if (os.platform() === "darwin") {
	appdataPath = os.homedir() + "/Library/Application Support"
} else if (os.platform() === "linux") {
	appdataPath = os.homeDir() + "/.local/share"
}
const swPath = appdataPath + "/Stormworks/data/microprocessors/"
const cPath = path.join(__dirname, "../Controllers/")
//const dPath = path.join(__dirname, "../Design/")
const mPath = path.join(__dirname, "../Media/")

let args = process.argv

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
})
const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

swXMLParser = new XMLParser({ignoreAttributes: false})
swXMLBuilder = new XMLBuilder({ignoreAttributes: false, format: true, indentBy: "\t", suppressEmptyNode: true, suppressBooleanAttributes: false, processEntities: true})
//swXMLBuilder = new XMLBuilder()

// node updateUtility -args
// -d:	updates database and controllers
// -g:	generates illustrations, thumbnails and descriptions from database
// -s: 	updates steam workshop items
// -e:	exports database contents

async function start() {
	//if (args.indexOf("-c") > -1) await execCopy()
	if (args.indexOf("-d") > -1) await execDatabase()
	if (args.indexOf("-g") > -1) await execImages()
	if (args.indexOf("-s") > -1) await execSteam()
	if (args.indexOf("-e") > -1) await execExport(args.indexOf("-e"))
}

// Copy
/*async function execCopy() {
	let files = fs.readdirSync(swPath).filter(file => file.startsWith("SRC-TCP") && file.endsWith(".xml"))
	let promises = []

	if (files.length === 0) return console.log("No controllers to be copied")

	console.log("The following controllers will be copied to the repository folder:")
	files.forEach((s, i) => {
		console.log("[" + (i+1) + "] " + s);
	})

	if (await prompt("Do you want to proceed [y/n] ") !== 'y') return;

	files.forEach((file) => {
		let fData = interpretName(file)
		let dData = database.controllers[fData.identifier]
		if (!dData || !dData.group) // unknown group
			return console.log("\x1b[33m%s\x1b[0m", "unknown group for controller: \"" + fData.identifier + "\", controller was not copied, please copy it manually")
		promises.push(fs.promises.copyFile(swPath + "/" + file, cPath + dData.group + " Group/SRC-TCP " + fData.identifier + ".xml")) // copy file
	})
	await Promise.all(promises)
}*/

// Database
async function execDatabase() {
	let dirs = fs.readdirSync(cPath, {withFileTypes: true}).filter(d => d.isDirectory()).map(d => d.name).filter(d => d.endsWith("Group"))
	let promises = []
	let controllers = []
	dirs.forEach(dir => fs.readdirSync(cPath + dir + "/").filter(file => file.startsWith("SRC-TCP") && file.endsWith(".xml")).forEach(file => controllers.push({
		path: cPath + dir + "/",
		file: file,
		group: dir.replace(" Group", ""),
		nameData: interpretName(file)
	})))

	controllers.forEach(c => {
		let buffer = fs.readFileSync(c.path + c.file, "utf-8")
		buffer = buffer.replaceAll(/(?<=description=")(?<desc>.+?) *\/\/ *.*?(?=")/gm, (_, desc) => desc) // clean

		let xml = swXMLParser.parse(buffer)

		let nodes = []
		xml.microprocessor.nodes.n.forEach((n) => {
			n = n.node
			let label = n["@_label"] || ""
			let desc = n["@_description"] || ""
			let mode = n["@_mode"] === "1"
			let type = Number(n["@_type"]) || 0
			// TODO: improve handling of automatic channel documentation generation (option for manual + check common too) or smth like that
			let channels = [c.group + "." + c.nameData.name.replaceAll(" ", ""), c.group, "Any"].map(d => (c => (database.connections.primary[c] ?? database.connections.redirects[c]) ? c : undefined)(d + "#" + label.replaceAll(" ", ""))).reduce((p, c) => p ?? c, undefined)
			if (channels) n["@_description"] = placeholders(n["@_description"] + " // {$c" + (mode ? "i" : "o") + channels + "}")
			nodes.push({
				label: n["@_label"] || "",
				description: desc,
				mode: mode, // true is input, false is output
				type: type,
				channels: channels,
				position: n.position && {
					x: Number(n.position["@_x"]) || 0,
					z: Number(n.position["@_z"]) || 0
				} || {x: 0, z: 0}
			})
		})

		c.data = mergeJSON(interpretName(xml.microprocessor["@_name"]), {
			group: c.group,
			description: xml.microprocessor["@_description"],
			width: xml.microprocessor["@_width"],
			length: xml.microprocessor["@_length"],
			nodes: nodes
		})

		buffer = swXMLBuilder.build(xml)
		buffer = buffer.replaceAll(" \/\/ \"", "\"") // fix empty channel lists

		if (c.nameData.identifier !== c.data.identifier) return console.log("\x1b[33m%s\x1b[0m", "identifier mismatch: \"" + c.identifier + "\" (filename) // \"" + c.data.identifier + "\" (name in xml file)")
		database.controllers[c.data.identifier] = mergeJSON(database.controllers[c.data.identifier] ?? {}, c.data)

		fs.writeFileSync(c.path + c.file, buffer.replace(/\r\n/g, "\n"))
	})

	// auto generate hierarchy
	// for modules and interface (ro and normal) we can auto generate the hierarchies
	for (let g in database.groups) {
		let lists = {}
		for (let c in database.controllers) {
			c = database.controllers[c]
			if (c.group !== g) continue
			c.hierarchy = {}
			lists[c.type] = lists[c.type] || []
			lists[c.type].push(c.identifier)
		}
		lists["Module"]?.forEach(c => {
			database.controllers[c].hierarchy.higher = ["[System] Main Controller", "[System] Hub"]
			database.controllers[c].hierarchy.lower = lists["Interface"]
		})
		lists["RO Module"]?.forEach(c => {
			database.controllers[c].hierarchy.higher = ["[System] Main Controller (Slave Only)"]
			database.controllers[c].hierarchy.lower = lists["RO Interface"]
		})
		lists["Interface"]?.forEach(c => {
			database.controllers[c].hierarchy.higher = lists["Module"]
			database.controllers[c].hierarchy.lower = (c.name === "Passenger Lighting") ? [] : lists["Extender"]
		})
		lists["RO Interface"]?.forEach(c => {
			database.controllers[c].hierarchy.higher = lists["RO Module"]
			database.controllers[c].hierarchy.lower = (interpretName(c).name === "Passenger Lighting") ? undefined : lists["Extender"]
		})
		lists["Extender"]?.forEach(c => {
			database.controllers[c].hierarchy.higher = lists["Interface"].filter(c => interpretName(c).name !== "Passenger Lighting")
		})
	}
}

// Images
async function execImages() {

	if (!fs.existsSync(mPath + "Export/")) fs.mkdirSync(mPath + "Export/")
	if (!fs.existsSync(mPath + "Export/Thumbnails/")) fs.mkdirSync(mPath + "Export/Thumbnails/")
	if (!fs.existsSync(mPath + "Export/Cards/")) fs.mkdirSync(mPath + "Export/Cards/")
	if (!fs.existsSync(mPath + "Export/Layout/")) fs.mkdirSync(mPath + "Export/Layout/")
	if (!fs.existsSync(mPath + "Export/Nodes/")) fs.mkdirSync(mPath + "Export/Nodes/")
	if (!fs.existsSync(mPath + "Export/LinkHigher/")) fs.mkdirSync(mPath + "Export/LinkHigher/")
	if (!fs.existsSync(mPath + "Export/LinkLower/")) fs.mkdirSync(mPath + "Export/LinkLower/")
	if (!fs.existsSync(mPath + "Export/Desc/")) fs.mkdirSync(mPath + "Export/Desc/")

	let promises = []
	let SVGs = []
	let TXTs = []
	let PNGs = []

	Object.values(database.controllers).forEach(c => {
		/*SVGs.push(mergeJSON(genControllerThumbnail(c), {
			path: mPath + "Export/Thumbnails/" + c.identifier
		}))*/
		SVGs.push(mergeJSON(genControllerCard(c), {
			path: mPath + "Export/Cards/" + c.identifier
		}))
		/**if (c.group !== "System") SVGs.push(mergeJSON(genControllerLayout(c), {
			path: mPath + "Export/Layout/" + c.identifier
		}))*/
		SVGs.push(mergeJSON(genControllerNodes(c), {
			path: mPath + "Export/Nodes/" + c.identifier
		}))
		/*SVGs.push(mergeJSON(genControllerLink(c, "Higher"), {
			path: mPath + "Export/LinkHigher/" + c.identifier
		}))
		SVGs.push(mergeJSON(genControllerLink(c, "Lower"), {
			path: mPath + "Export/LinkLower/" + c.identifier
		}))*/
		TXTs.push(mergeJSON(genControllerDesc(c), {
			path: mPath + "Export/Desc/" + c.identifier
		}))
	})

	Object.values(database.groups).forEach(g => {
		/*SVGs.push(mergeJSON(genGroupThumbnail(g), {
			path: mPath + "Export/Thumbnails/" + g.identifier
		}))
		SVGs.push(mergeJSON(genGroupCard(g), {
			path: mPath + "Export/Cards/" + g.identifier
		}))
		TXTs.push(mergeJSON(genGroupDesc(g), {
			path: mPath + "Export/Desc/" + g.identifier
		}))*/
	})

	// convert to png
	SVGs.forEach(svg => PNGs.push({
		path: svg.path,
		data: (new Resvg(svg.data, {
			font: { loadSystemFonts: true, fontDirs: [mPath + "Fonts/"] },
			fitTo: { mode: "original" }
		})).render().asPng()
	}))

	// write all files
	//SVGs.forEach(svg => promises.push(fs.promises.writeFile(svg.path + ".svg", svg.data)))
	PNGs.forEach(png => promises.push(fs.promises.writeFile(png.path + ".png", png.data)))
	TXTs.forEach(txt => promises.push(fs.promises.writeFile(txt.path + ".txt", txt.data)))

	await Promise.all(promises)
}

// Steam
async function execSteam() {

	// setup folders
	let sPath = path.join(__dirname, ".steam/")
	if (!fs.existsSync(sPath)) fs.mkdirSync(sPath)
	if (fs.existsSync(sPath + "temp/")) fs.rmSync(sPath + "temp/", {recursive: true})
	fs.mkdirSync(sPath + "temp/")

	// filter controllers
	let controllers = Object.values(database.controllers).filter(c => c.workshopID && c.workshopID !== "")
	if (controllers.length === 0) return;

	let vdfTemplate = fs.readFileSync(sPath + "template.vdf", "utf-8")
	let commandChain = ""

	// setup for each controller (let user choose)
	for (const c of controllers) {
		if (await prompt("Upload controller: " + c.identifier + " [y/n] ") !== 'y') continue;

		// add content dir
		fs.mkdirSync(sPath + "temp/" + c.identifier + "/")

		// setup vdf file
		let desc = fs.readFileSync(mPath + "Export/Desc/" + c.identifier + ".txt", "utf-8")
		let vdf = placeholders(vdfTemplate, mergeJSON(c, {
			publishedfileid: c.workshopID,
			contentfolder: sPath + "temp/" + c.identifier + "/",
			previewfile: mPath + "Export/Thumbnails/" + c.identifier + ".png",
			wsDescription: desc
		}))

		// copy and safe files
		let promises = []
		promises.push(fs.promises.copyFile(cPath + c.group + " Group/SRC-TCP " + c.identifier + ".xml", sPath + "temp/" + c.identifier + "/microcontroller.xml"))
		promises.push(fs.promises.copyFile(mPath + "Export/Thumbnails/" + c.identifier + ".png", sPath + "temp/" + c.identifier + "/workshop_preview.png"))
		promises.push(fs.promises.writeFile(sPath + "temp/" + c.identifier + ".vdf", vdf,"utf-8"))
		await Promise.all(promises)

		// add command
		commandChain += "+workshop_build_item \"" + sPath + "temp/" + c.identifier + ".vdf\" "
	}

	// execute command
	try {
		let TFA = await prompt("Steam guard code? ")
		execSync(process.env.steamCMDPath + "steamcmd.exe +login \"" + process.env.steamLogin + "\" \"" + process.env.steamPassword + "\" " + TFA + " " + commandChain + "+quit", {stdio: "inherit"})
	} catch (e) {
		console.error(e)
	}

	if (fs.existsSync(sPath + "temp/")) fs.rmSync(sPath + "temp/", {recursive: true})

}

async function execExport(index) {
	let wrongFormat = () => console.log("\x1b[33m%s\x1b[0m", "wrong format, please use: -e {composite} {csv}")

	let arg1 = args[index+1], arg2  = args[index+2]
	if (!(arg1 && arg2 && !arg1.startsWith("-") && !arg2.startsWith("-"))) return wrongFormat()
	if (!(arg1 === "composite" && arg2 === "csv")) return wrongFormat()

	let groups = {};

	for (let identifier in database.connections.primary) {
		let domain = identifier.match(/^[^#]*/)[0]
		if (!database.groups[domain]) continue;
		if (!groups[domain]) groups[domain] = {
			header1: "channel",
			header2: "",
			entries: Array(32).fill().map((v, i) => "" + (i+1))
		}

		let channels = resolveChannels(identifier);
		let pushChannels = type => {
			groups[domain].header2 += "," + type
			for (let i = 0; i < 32; i++) {
				groups[domain].entries[i] += "," + "\"" + (channels[type][i+1]?.label ?? "") + "\""
			}
		}

		groups[domain].header1 += "," + identifier.match(/(?<=#).*/)[0] + ","
		pushChannels("boolean")
		pushChannels("number")
	}

	if (!fs.existsSync(path.join(__dirname, "/.export/"))) fs.mkdirSync(path.join(__dirname, "/.export/"))

	for (let group in groups) {
		let file = groups[group].header1+"\n"+groups[group].header2+"\n"
		for (let i = 0; i < 32; i++) file += groups[group].entries[i]+"\n"
		fs.writeFileSync(path.join(__dirname, "/.export/" + group + ".csv"), file, "utf-8")
	}
}

interpretName = name => {
	//let info = name.matchAll(/SRC-TCP *\[(.*?)\] *(.*?(?= *v\d| *\.| *\(| *$)) *(\((.*?)\))? *v?([0-9._]*[0-9])?/gm).next().value
	let info = name.matchAll(/\[(.*?)\] *(.*?(?= *v\d| *\.| *\(| *$)) *(\((.*?)\))? *v?([0-9._]*[0-9])?/gm).next().value
	return {
		identifier: "[" + info[1] + "] " + info[2] + (info[3] ? " (" + info[4] + ")" : ""),
		type: info[1],
		name: info[2],
		readonly: info[1].indexOf("RO") > -1,
		modifier: info[4],
		version: (info[5] ? info[5].replaceAll("_", ".") : undefined)
	}
}

placeholders = (buffer, x) => buffer.replaceAll(/{\$([^}]*?)}/gm, (_, placeholder) => (res => typeof res === "function" ? res(x) : res)(resolvePlaceholder(placeholder)))
resolvePlaceholder = placeholder => {
	let t = placeholder.charAt(0)
	placeholder = placeholder.substring(1)
	switch (t) {
		case 'c':
			let mode = placeholder.charAt(0) === 'i'
			let c = resolveChannels(placeholder.substring(1))
			let convert = (type) => {
				let res = []
				for (let ch in c[type])	res.push(mergeJSON(c[type][ch], { channel: ch }))
				return res.filter(v => (mode ? v.visibility.in : v.visibility.out) > 1).sort((a,b) => a.channel - b.channel).reduce((prev, curr) => prev += type.charAt(0).toUpperCase() + curr.channel + ": " + curr.label + "; ", "")
			}
			let res = (convert("boolean") + convert("number")).trim()
			return (res === "") ? "" : "Channels: " + res
		case ".": return x => x[placeholder]
		case "m": return x => genDescriptionComponent(placeholder, x)
		case "u": return database.definitions.urls[placeholder]
		default: return ""
	}
}

resolveChannels = entry => {

	if (typeof entry === "string") return resolveChannels(Object.values(database.connections).map(x => x[entry]).filter(x => x !== undefined)[0]) // or instead of .filter use .reduce((p, c) => p ?? c, undefined))

	let resolved = {
		boolean: {},
		number: {}
	}

	let expandVis = (vis, def) => typeof vis === "number" ? { in: vis, out: vis } : { in: vis?.in ?? def, out: vis?.out ?? def }

	let vis = expandVis(entry.visibility, 0)
	let visLimit = expandVis(entry.visibilityLimit, 3)

	let expandChannels = type => Object.entries(entry.channels ? entry.channels[type] ?? {} : {}).forEach(ch => resolved[type][ch[0]] = {
		label: typeof ch[1] === "string" ? ch[1] : ch[1].label ?? "",
		visibility: typeof ch[1] === "string" ? vis : expandVis(ch[1].visibility, 0)
	})

	expandChannels("boolean")
	expandChannels("number")

	let inherit = typeof entry.inherit === "undefined" ? [] : Array.isArray(entry.inherit) ? entry.inherit : [entry.inherit]
	inherit.forEach(inherited => {
		inherited = resolveChannels(inherited)
		resolved.boolean = mergeJSON(inherited.boolean, resolved.boolean)
		resolved.number = mergeJSON(inherited.number, resolved.number)
	})

	let applyLimit = type => Object.values(resolved[type]).forEach(ch => ch.visibility = {
		in: Math.min(ch.visibility.in, visLimit.in),
		out: Math.min(ch.visibility.out, visLimit.out)
	})

	applyLimit("boolean")
	applyLimit("number")

	return resolved
}

mergeJSON = (old, updated) => {
	let res = JSON.parse(JSON.stringify(old))
	for (let attr in updated) res[attr] = updated[attr]
	return res
}

// run
start().then(() => {
	fs.writeFileSync(cPath + "database.json", JSON.stringify(database, null, "\t"))
	rl.close()
	console.log("script finished")
})