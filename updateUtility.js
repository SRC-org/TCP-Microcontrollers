fs = require('fs')

let path = process.env.APPDATA + '\\Stormworks\\data\\microprocessors'

fs.readdir(path, (err, files) => {
	files.forEach((file, i) => {
		if (!file.startsWith('SRC-TCP') || !file.endsWith('.xml')) return
		let info = file.matchAll(/(?<=\[)(.*?)(?=\] )(?:\] )(.*?)(?=\.| \(| v[\d\_]*\.xml)(?:(?: \()([a-zA-Z\s]+)(?:\)))?(?: v)?([\d\_]*)?/g).next().value // i will forget how this works tomorrow

		let controllerInfo = {
			full: '[' + info[1] + '] ' + info[2] + (info[3] ? ' (' + info[3] + ')' : ''),
			group: getGroup(info),
			type: info[1],
			name: info[2],
			modifier: info[3],
			version: (info[4] ? info[4].replaceAll('_', '.') : undefined)
		}

		fs.copyFile(path + '\\' + file, '.\\' + controllerInfo.group + ' Group\\' + file, (err) => {
			if (err) console.log(err)
			else console.log('copy of ' + controllerInfo.full + ' succeeded')
		})
	})
})

function getGroup(info) {
	if (info[1] === 'System') return 'System'
	if (info[2].startsWith('Passenger')) return 'Passenger'
	if (info[2].startsWith('Decouple')) return 'Decouple'
	if (info[2].startsWith('Drivetrain')) return 'Drivetrain'
	if (info[2].startsWith('Exterior Lighting') || info[2].startsWith('Lightbox')) return 'Lighting'
}