fs = require('fs')
database = require('./database.json')

const swPath = process.env.APPDATA + '/Stormworks/data/microprocessors'
let args = process.argv;

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

start().then(() => {
	fs.writeFileSync('./database.json', JSON.stringify(database, null, '\t'))
	console.log('script finished')
})

// Register
async function execRegister(index) {
	let wrongFormat = () => console.log('\x1b[33m%s\x1b[0m', 'wrong format, please use: -r controller,controller group,group')

	let arg1 = args[index+1], arg2  = args[index+2]
	if (!(arg1 && arg2 && !arg1.startsWith('-') && !arg2.startsWith('-'))) return wrongFormat()

	let controllers = arg1.split(','), groups = arg2.split(',')
	if (controllers.length !== groups.length) return wrongFormat()

	controllers.forEach((c, i) => {
		if (c === '' || groups[i] === '') return wrongFormat();
		let g = groups[i]
		database.controllers[c] = {
			identifier: c,
			group: g
		}
		if (!fs.existsSync('./' + g + ' Group/')) fs.mkdirSync('./' + g + ' Group/')
	})
}

// Copy
async function execCopy() {
	let files = (await fs.promises.readdir(swPath)).filter(file => file.startsWith('SRC-TCP') && file.endsWith('.xml'))
	let promises = []

	files.forEach((file, i) => {
		let fileData = data.fromFile(file)
		let entry = data.fromDatabase(fileData.identifier)
		if (!entry || !entry.group) return console.log('\x1b[33m%s\x1b[0m', 'unknown group for controller: \'' + fileData.identifier + '\', controller was not copied, please register it using -r')
		if (entry.version && entry.version !== fileData.version) promises.push(fs.promises.unlink('./' + entry.group + ' Group/SRC-TCP ' + fileData.identifier + ' v' + entry.version.replaceAll('.', '_') + '.xml')) // replace old version if present
		entry.version = fileData.version // update version
		promises.push(fs.promises.copyFile(swPath + '/' + file, './' + entry.group + ' Group/' + file)) // copy file
	})
	await Promise.all(promises)
}

// Database
async function execDatabase() {
	let dirs = (await fs.promises.readdir('./', {withFileTypes: true})).filter(d => d.isDirectory()).map(d => d.name).filter(d => d.endsWith('Group'))
	let promises = []
	let controllerData = []
	dirs.forEach((dir, i) => {
		let promise = fs.promises.readdir('./' + dir + '/')
		promise.then(files => files.filter(file => file.startsWith('SRC-TCP') && file.endsWith('.xml')).forEach((file, i) => controllerData.push(data.fromFile(file))))
		promises.push(promise)
	})
	await Promise.all(promises)

	controllerData.forEach(info => {
		if (database.controllers[info.identifier] === undefined) {
			console.log('\x1b[33m%s\x1b[0m', 'controller with no database entry: \'' + info.identifier + '\', please register it using -r')
			database.controllers[info.identifier] = info
			return
		}
		for (let attr in info) database.controllers[info.identifier][attr] = info[attr]
	})
}

// Images
async function execImages() {
	console.log('image generation not supported yet')
}

// Steam
async function execSteam() {
	console.log('steam upload not supported yet')
}

data = {
	matchInfo: (file) => {
		return file.matchAll(/(?<=\[)(.*?)(?=\] )(?:\] )(.*?)(?=\.| \(| v[\d\_]*\.xml)(?:(?: \()([a-zA-Z\s]+)(?:\)))?(?: v)?([\d\_]*)?/g).next().value // i will forget how this works tomorrow
	},
	fromFile: (file) => {
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
	}
}