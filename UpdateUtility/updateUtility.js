fs = require("fs")
path = require("path")
database = require("../Controllers/database.json")

const { XMLParser/*, XMLBuilder, XMLValidator*/ } = require("fast-xml-parser")
const { convert } = require("convert-svg-to-png")
const { genControllerCard, genControllerThumbnail, genControllerNodes, genGroupThumbnail } = require("./mediaElements")

const swPath = process.env.APPDATA + "/Stormworks/data/microprocessors/"
const cPath = path.join(__dirname, "../Controllers/")
//const dPath = path.join(__dirname, "../Design/")
const mPath = path.join(__dirname, "../Media/")

let args = process.argv

swXMLParser = new XMLParser({ignoreAttributes: false})

// node updateUtility -args
// -r:	registers a new controller into the database (identifier and group)
// -c:	copies the files from stormworks data to repository folder
// -d:	updates database with repository folder contents
// -i:	generates illustrations and thumbnails from database
// -s: 	updates steam workshop items

async function start() {
	if (args.indexOf("-r") > -1) await execRegister(args.indexOf("-r"))
	if (args.indexOf("-c") > -1) await execCopy()
	if (args.indexOf("-d") > -1) await execDatabase()
	if (args.indexOf("-i") > -1) await execImages()
	if (args.indexOf("-s") > -1) await execSteam()
}

// Register
async function execRegister(index) {
	let wrongFormat = () => console.log("\x1b[33m%s\x1b[0m", "wrong format, please use: -r controller1,controller2,... group1,group2,...")

	let arg1 = args[index+1], arg2  = args[index+2]
	if (!(arg1 && arg2 && !arg1.startsWith("-") && !arg2.startsWith("-"))) return wrongFormat()

	let controllers = arg1.split(","), groups = arg2.split(",")
	if (controllers.length !== groups.length) return wrongFormat()

	controllers.forEach((c, i) => {
		if (c === "" || groups[i] === "") return wrongFormat()
		let g = groups[i]
		database.controllers[c] = {
			identifier: c,
			group: g
		}
		if (!fs.existsSync(cPath + g + " Group/")) fs.mkdirSync(cPath + g + " Group/")
	})
}

// Copy
async function execCopy() {
	let files = fs.readdirSync(swPath).filter(file => file.startsWith("SRC-TCP") && file.endsWith(".xml"))
	let promises = []

	// TODO: ask for confirmation

	files.forEach((file) => {
		let fData = data.fromName(file)
		let dData = data.fromDatabase(fData.identifier)
		if (!dData || !dData.group) // unknown group
			return console.log("\x1b[33m%s\x1b[0m", "unknown group for controller: \"" + fData.identifier + "\", controller was not copied, please register it using -r")
		/*if (dData.version && dData.version !== fData.version) // replace old version if present
			promises.push(fs.promises.unlink(cPath + dData.group + " Group/SRC-TCP " + fData.identifier + " v" + dData.version.replaceAll(".", "_") + ".xml"))*/
		//dData.version = fData.version // update version in database
		//promises.push(fs.promises.copyFile(swPath + "/" + file, cPath + dData.group + " Group/" + file)) // copy file
		promises.push(fs.promises.copyFile(swPath + "/" + file, cPath + dData.group + " Group/SRC-TCP " + fData.identifier + ".xml")) // copy file
	})
	await Promise.all(promises)
}

// Database
async function execDatabase() {
	let dirs = fs.readdirSync(cPath, {withFileTypes: true}).filter(d => d.isDirectory()).map(d => d.name).filter(d => d.endsWith("Group"))
	let promises = []
	let controllers = []
	dirs.forEach((dir) => {
		let promise = fs.promises.readdir(cPath + dir + "/")
		promise.then(groupFiles => groupFiles.filter(file => file.startsWith("SRC-TCP") && file.endsWith(".xml")).forEach((file) => controllers.push({
			path: cPath + dir + "/",
			file: file,
			nameData: data.fromName(file),
			fileData: data.fromFile(cPath + dir + "/" + file)
		})))
		promises.push(promise)
	})
	await Promise.all(promises)

	controllers.forEach(info => {
		if (info.nameData.identifier !== info.fileData.identifier)
			return console.log("\x1b[33m%s\x1b[0m", "identifier mismatch: \"" + info.nameData.identifier + "\" (filename) // \"" + info.fileData.identifier + "\" (name in xml file)")
		if (database.controllers[info.fileData.identifier] === undefined)
			return console.log("\x1b[33m%s\x1b[0m", "controller with no database entry: \"" + info.fileData.identifier + "\", please register it using -r")
			//database.controllers[info.data.identifier] = {}

		//mergeJSON(database.controllers[info.nameData.identifier], info.nameData)
		mergeJSON(database.controllers[info.fileData.identifier], info.fileData)
	})
}

// Images
async function execImages() {

	if (!fs.existsSync(mPath + "Export/")) fs.mkdirSync(mPath + "Export/")
	if (!fs.existsSync(mPath + "Export/Thumbnails/")) fs.mkdirSync(mPath + "Export/Thumbnails/")
	if (!fs.existsSync(mPath + "Export/Cards/")) fs.mkdirSync(mPath + "Export/Cards/")
	if (!fs.existsSync(mPath + "Export/Nodes/")) fs.mkdirSync(mPath + "Export/Nodes/")

	let promises = []
	let SVGs = []
	let PNGs = []

	Object.values(database.controllers).forEach(c => {
		/*SVGs.push(mergeJSON(genControllerThumbnail(c), {
			path: mPath + "Export/Thumbnails/" + c.identifier
		}))
		SVGs.push(mergeJSON(genControllerCard(c), {
			path: mPath + "Export/Cards/" + c.identifier
		}))*/
		SVGs.push(mergeJSON(genControllerNodes(c), {
			path: mPath + "Export/Nodes/" + c.identifier
		}))
	})

	Object.values(database.groups).forEach(g => {
		/*SVGs.push(mergeJSON(genGroupThumbnail(g), {
			path: mPath + "Export/Thumbnails/" + g.identifier
		}))*/
	})

	// convert to png
	for (let i = 0; i < SVGs.length; i++) {
		let svg = SVGs[i]
		let p = convert(svg.data, svg.dimensions)
		p.then(png =>
			PNGs.push({
				path: svg.path,
				data: png
			})
		)
		promises.push(p)
		if ((i+1) % 9 === 0) (await Promise.all(promises).then(() => promises = []))
	}
	await Promise.all(promises).then(() => promises = [])

	// write all files
	SVGs.map(svg => promises.push(fs.promises.writeFile(svg.path + ".svg", svg.data)))
	PNGs.map(png => promises.push(new Promise((resolve, reject) => {
		const file = fs.createWriteStream(png.path + ".png")
		file.write(png.data)
		file.end()
		file.on("finish", resolve)
		file.on("error", reject)
	})))

	await Promise.all(promises)
}

// Steam
async function execSteam() {
	console.log("steam upload not supported yet")
}

/*
 * new regex:
 * /SRC-TCP *\[(.*?)\] *(.*?(?= *v\d| *\.| *\(| *$)) *(\((.*?)\))? *v?([0-9._]*[0-9])?/gm
 *
 * old regex:
 * /(?<=\[)(.*?)(?=\] )(?:\] )(.*?)(?=\.| \(| v[\d\_]*\.xml)(?:(?: \()([a-zA-Z\s]+)(?:\)))?(?: v)?([\d\_]*)?/g
 */

data = {
	matchInfo: (str) => {
		return str.matchAll(/SRC-TCP *\[(.*?)\] *(.*?(?= *v\d| *\.| *\(| *$)) *(\((.*?)\))? *v?([0-9._]*[0-9])?/gm).next().value // I will forget how this works tomorrow
	},
	fromName: (name) => {
		let info = data.matchInfo(name)
		return {
			identifier: "[" + info[1] + "] " + info[2] + (info[3] ? " (" + info[4] + ")" : ""),
			type: info[1],
			name: info[2],
			readonly: info[1].indexOf("RO") > -1,
			modifier: info[4],
			version: (info[5] ? info[5].replaceAll("_", ".") : undefined)
		}
	},
	fromDatabase: (identifier) => {
		return database.controllers[identifier]
	},
	fromFile: (path) => {
		let rawXML = fs.readFileSync(path)
		let xml = swXMLParser.parse(rawXML)
		let nodes = []
		xml.microprocessor.nodes.n.forEach((n) => {
			n = n.node
			nodes.push({
				label: n["@_label"] || "",
				description: n["@_description"] || "",
				mode: (n["@_mode"] === "1"), // true is input, false is output
				type: Number(n["@_type"]) || 0,
				position: n.position && {
					x: Number(n.position["@_x"]) || 0,
					z: Number(n.position["@_z"]) || 0
				} || {x: 0, z: 0}
			})
		})

		return mergeJSON(data.fromName(xml.microprocessor["@_name"]), {
			description: xml.microprocessor["@_description"],
			width: xml.microprocessor["@_width"],
			length: xml.microprocessor["@_length"],
			nodes: nodes
		})
	}
}

mergeJSON = (old, updated) => {
	for (let attr in updated) old[attr] = updated[attr]
	return old
}

// run
start().then(() => {
	fs.writeFileSync(cPath + "database.json", JSON.stringify(database, null, "\t"))
	console.log("script finished")
})