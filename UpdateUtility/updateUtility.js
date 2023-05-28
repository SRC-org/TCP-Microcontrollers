fs = require('fs')
path = require('path')
database = require('../Controllers/database.json')
const { XMLParser, XMLBuilder, XMLValidator } = require("fast-xml-parser")
const { createSVGWindow } = require('svgdom')
const { SVG, registerWindow } = require('@svgdotjs/svg.js')

const swPath = process.env.APPDATA + '/Stormworks/data/microprocessors/'
const cPath = path.join(__dirname, '../Controllers/')
const dPath = path.join(__dirname, '../Design/')

let args = process.argv

swXMLParser = new XMLParser({ignoreAttributes: false})

// load svg templates
const window = createSVGWindow()
const document = window.document
registerWindow(window, document)
let thumbnail = SVG().svg(fs.readFileSync(dPath + 'Thumbnails/Template.svg').toString())
//let card = SVG().svg(fs.readFileSync(dPath + 'Cards/Template.svg').toString())

// node updateUtility -args
// -r:	registers a new controller into the database (identifier and group)
// -c:	copies the files from stormworks data to repository folder
// -d:	updates database with repository folder contents
// -i:	generates illustrations and thumbnails from database
// -s: 	updates steam workshop items

async function start() {
	if (args.indexOf('-r') > -1) await execRegister(args.indexOf('-r'))
	if (args.indexOf('-c') > -1) await execCopy()
	if (args.indexOf('-d') > -1) await execDatabase()
	if (args.indexOf('-i') > -1) await execImages()
	if (args.indexOf('-s') > -1) await execSteam()
}

// Register
async function execRegister(index) {
	let wrongFormat = () => console.log('\x1b[33m%s\x1b[0m', 'wrong format, please use: -r controller,controller group,group')

	let arg1 = args[index+1], arg2  = args[index+2]
	if (!(arg1 && arg2 && !arg1.startsWith('-') && !arg2.startsWith('-'))) return wrongFormat()

	let controllers = arg1.split(','), groups = arg2.split(',')
	if (controllers.length !== groups.length) return wrongFormat()

	controllers.forEach((c, i) => {
		if (c === '' || groups[i] === '') return wrongFormat()
		let g = groups[i]
		database.controllers[c] = {
			identifier: c,
			group: g
		}
		if (!fs.existsSync(cPath + g + ' Group/')) fs.mkdirSync(cPath + g + ' Group/')
	})
}

// Copy
async function execCopy() {
	let files = fs.readdirSync(swPath).filter(file => file.startsWith('SRC-TCP') && file.endsWith('.xml'))
	let promises = []

	// TODO: ask for confirmation

	files.forEach((file, i) => {
		let fData = data.fromFileName(file)
		let dData = data.fromDatabase(fData.identifier)
		if (!dData || !dData.group) // unknown group
			return console.log('\x1b[33m%s\x1b[0m', 'unknown group for controller: \'' + fData.identifier + '\', controller was not copied, please register it using -r')
		if (dData.version && dData.version !== fData.version) // replace old version if present
			promises.push(fs.promises.unlink(cPath + dData.group + ' Group/SRC-TCP ' + fData.identifier + ' v' + dData.version.replaceAll('.', '_') + '.xml'))
		dData.version = fData.version // update version in database
		promises.push(fs.promises.copyFile(swPath + '/' + file, cPath + dData.group + ' Group/' + file)) // copy file
	})
	await Promise.all(promises)
}

// Database
async function execDatabase() {
	let dirs = fs.readdirSync(cPath, {withFileTypes: true}).filter(d => d.isDirectory()).map(d => d.name).filter(d => d.endsWith('Group'))
	let promises = []
	let controllers = []
	dirs.forEach((dir, i) => {
		let promise = fs.promises.readdir(cPath + dir + '/')
		promise.then(groupFiles => groupFiles.filter(file => file.startsWith('SRC-TCP') && file.endsWith('.xml')).forEach((file, i) => controllers.push({
			path: cPath + dir + '/',
			file: file,
			nameData: data.fromFileName(file),
			fileData: data.fromFile(cPath + dir + '/' + file)
		})))
		promises.push(promise)
	})
	await Promise.all(promises)

	controllers.forEach(info => {
		if (database.controllers[info.nameData.identifier] === undefined) {
			console.log('\x1b[33m%s\x1b[0m', 'controller with no database entry: \'' + info.nameData.identifier + '\', please register it using -r')
			database.controllers[info.nameData.identifier] = {}
		}
		mergeJSON(database.controllers[info.nameData.identifier], info.nameData)
		mergeJSON(database.controllers[info.nameData.identifier], info.fileData)
	})
}

// Images
async function execImages() {
	Object.values(database.controllers).forEach(c =>{
		console.log(c.name)
		console.log(c.type)
	})
	//console.log(Object.values(database.controllers))
}

// Steam
async function execSteam() {
	console.log('steam upload not supported yet')
}

data = {
	matchInfo: (file) => {
		return file.matchAll(/(?<=\[)(.*?)(?=\] )(?:\] )(.*?)(?=\.| \(| v[\d\_]*\.xml)(?:(?: \()([a-zA-Z\s]+)(?:\)))?(?: v)?([\d\_]*)?/g).next().value // i will forget how this works tomorrow
	},
	fromFileName: (file) => {
		let info = data.matchInfo(file)
		return {
			identifier: '[' + info[1] + '] ' + info[2] + (info[3] ? ' (' + info[3] + ')' : ''),
			type: info[1],
			name: info[2],
			modifier: info[3],
			version: (info[4] ? info[4].replaceAll('_', '.') : undefined)
		}
	},
	fromDatabase: (identifier) => {
		return database.controllers[identifier]
	},
	fromFile: (path) => {
		rawXML = fs.readFileSync(path)
		let xml = swXMLParser.parse(rawXML)
		let nodes = []
		xml.microprocessor.nodes.n.forEach((n) => {
			n = n.node
			//console.log(n['@_label'])
			nodes.push({
				label: n['@_label'] || '',
				description: n['@_description'] || '',
				mode: (n['@_mode'] === '1'), // false is input, true is output
				type: Number(n['@_type']) || 0,
				position: n.position && {
					x: Number(n.position['@_x']) || 0,
					z: Number(n.position['@_z']) || 0
				} || {x: 0, z: 0}
			})
		})
		return {
			description: xml.microprocessor['@_description'],
			width: xml.microprocessor['@_width'],
			length: xml.microprocessor['@_length'],
			nodes: nodes
		}
	}
}

mergeJSON = (old, updated) => {
	for (attr in updated) old[attr] = updated[attr]
}

// run
start().then(() => {
	fs.writeFileSync(cPath + 'database.json', JSON.stringify(database, null, '\t'))
	console.log('script finished')
})