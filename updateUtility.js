fs = require('fs')
data = require('./database.json')

const swPath = process.env.APPDATA + '/Stormworks/data/microprocessors'
let args = process.argv;

async function start() {
	if (args.indexOf('-c') > -1) await copy()
	if (args.indexOf('-d') > -1) await database()
	if (args.indexOf('-i') > -1) await images()
	if (args.indexOf('-s') > -1) await steam()
}

start().then(() => {
	fs.writeFileSync('./database.json', JSON.stringify(data))
	console.log('finished')
})

// copy the files
async function copy() {
	files = (await fs.promises.readdir(swPath)).filter(file => file.startsWith('SRC-TCP') && file.endsWith('.xml'))
	let promises = []

	files.forEach((file, i) => {
		//if (!file.startsWith('SRC-TCP') || !file.endsWith('.xml')) return

		let info = generateInfo(file)
		promises.push(fs.promises.copyFile(swPath + '/' + file, './' + info.group + ' Group/' + file))
	})

	// TODO: replace old versions on version number change

	await Promise.all(promises)
}

// update database from folders
async function database() {
	let dirs = (await fs.promises.readdir('./', { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).filter(d => d.endsWith('Group'))
	let promises = []
	let infos = []
	dirs.forEach((dir, i) => {
		let promise = fs.promises.readdir('./' + dir + '/')
		promise.then(files => files.filter(file => file.startsWith('SRC-TCP') && file.endsWith('.xml')).forEach((file, i) => infos.push(generateInfo(file))))
		promises.push(promise)
	})
	await Promise.all(promises)

	infos.forEach(info => {
		if (data.controllers[info.full] === undefined) {
			console.log('new controller: \"' + info.full + '\", please insert remaining info manually into the database')
			data.controllers[info.full] = info
			return
		}
		updateEntry(data.controllers[info.full], info)
		//console.log('database entry updated: ' + info.full)
	})
}

async function images() {
	console.log('image generation not supported yet')
}

async function steam() {
	console.log('steam upload not supported yet')
}

// node updateUtility -c -d -i -s
// -c or --copy:		copies the files from stormworks data to git folder
// -d or --database:	updates database with git folder contents
// -i or --images:		generates illustrations and thumbnails from database
// -s or --steam: 		updates steam workshop items

function generateInfo(file) {
	let info = file.matchAll(/(?<=\[)(.*?)(?=\] )(?:\] )(.*?)(?=\.| \(| v[\d\_]*\.xml)(?:(?: \()([a-zA-Z\s]+)(?:\)))?(?: v)?([\d\_]*)?/g).next().value // i will forget how this works tomorrow
	return {
		full: '[' + info[1] + '] ' + info[2] + (info[3] ? ' (' + info[3] + ')' : ''),
		group: getGroup(info),
		type: info[1],
		name: info[2],
		modifier: info[3],
		version: (info[4] ? info[4].replaceAll('_', '.') : undefined)
	}
}

function getGroup(info) {
	if (info[1] === 'System') return 'System'
	if (info[2].startsWith('Passenger')) return 'Passenger'
	if (info[2].startsWith('Decouple')) return 'Decouple'
	if (info[2].startsWith('Drivetrain')) return 'Drivetrain'
	if (info[2].startsWith('Exterior Lighting') || info[2].startsWith('Lightbox')) return 'Lighting'
}

function updateEntry(entry, info) {
	entry.version = info.version
}