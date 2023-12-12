fs = require("fs")
path = require("path")

const { createSVGWindow } = require("svgdom")
const { SVG, registerWindow } = require("@svgdotjs/svg.js")
const textSVG = require('text-to-svg')

const mPath = path.join(__dirname, "../Media/")

// prepare svg lib
const window = createSVGWindow()
const document = window.document
registerWindow(window, document)

// load templates
let thumbnailTemplate = SVG().svg(fs.readFileSync(mPath + "Templates/Thumbnail.svg").toString())
let cardTemplate = SVG().svg(fs.readFileSync(mPath + "Templates/Card.svg").toString())

// text width calculations
getTextWidthFunction = font => options => text => textSVG.loadSync(mPath + 'Fonts/' + font).getMetrics(text, options).width
textWidth = {
	robotoLight: getTextWidthFunction('Roboto-Light.ttf'),
	robotoBold: getTextWidthFunction('Roboto-Bold.ttf')
}

/*
 * Elements
 */

genThumbnail = o => {

	// elements
	let eFrame = thumbnailTemplate.find("#Frame")
	let eName = thumbnailTemplate.find("#Name")
	let eType = thumbnailTemplate.find("#Type")

	// colour
	let colour = database.definitions.groupColours[o.group]
	eFrame.css({fill: "#" + colour})
	eType.attr({class: "type"})
	eType.addClass(rgbToHsl(hexToRgb(colour)).l > .5 ? "cDark" : "cLight")

	// text
	let wName = wrapText(o.name, textWidth.robotoBold({fontSize: 80}), 392)
	eName.attr({dy: -80 * (wName.length-1)})
	eName.text(add => wName.map(l => add.tspan(l).attr({x: 0, y: 0})))
	eType.first().text(o.type)

	return {
		dimensions: { width: 512, height: 512 },
		data: fixSVG(thumbnailTemplate.svg())
	}
}

genControllerThumbnail = c => {
	return genThumbnail({
		name: c.name,
		group: c.group,
		type: c.type
	})
}

genGroupThumbnail = g => {
	return genThumbnail({
		name: g.name,
		group: g.name,
		type: "group"
	})
}

genControllerCard = c => {

	// elements
	let eFrame = cardTemplate.find("#Frame")
	let eName = cardTemplate.find("#Name")
	let eInfo = cardTemplate.find("#Info")
	let eDescription = cardTemplate.find("#Description")
	let eTitleNext = cardTemplate.find("#TitleNext")
	let eROMarker = cardTemplate.find("#ROMarker")
	let eROText = cardTemplate.find("#ROText")
	let eMicrocontroller = cardTemplate.find("#Microcontroller")
	let eMCBackground = cardTemplate.find("#MCBackground")
	let eMCBorder = cardTemplate.find("#MCBorder")

	// colour
	let colour = database.definitions.groupColours[c.group]
	eFrame.css({fill: "#" + colour})
	eROMarker.css({fill: "#" + colour})
	eROText.attr({class: "roText"})
	eROText.addClass(rgbToHsl(hexToRgb(colour)).l > .5 ? "cDark" : "cLight")
	if (c.readonly) eROMarker.show()
	else eROMarker.hide()

	// text
	eName.text(c.name)
	eInfo.text(c.identifier + (c.version ? " v" + c.version : ""))
	eDescription.attr({dy: -45}).text(add => wrapText(c.description, textWidth.robotoLight({fontSize: 35}), 920).map(l => add.tspan(l).attr({x: 0, y: 0})))
	eTitleNext.text("Next" + (c.readonly ? " (Readonly)" : ""))

	// microcontroller
	eMicrocontroller.attr({transform: "translate(" + (1680 - 120 * (c.width - 1)) + ",120)"})
	let pos = {x: 0, y: 0, width: 120 * c.width, height: 120 * c.length}
	eMCBackground.attr(pos)
	eMCBorder.attr(pos)

	// nodes
	let eNodes = SVG("<g id=\"Nodes\"></g>")
	c.nodes.forEach(node => {
		let nodeColour = database.definitions.nodeColours[node.type]

		let eNodeBox = SVG("<rect class=\"cBack nodeBox\" width=\"110\" height=\"110\" rx=\"15\" ry=\"15\"/>")
		let eNodeIcon = SVG(node.mode ? "<circle style=\"stroke-width: 10px; fill: none; stroke: #" + nodeColour + ";\"  r=\"25\"/>" : "<circle style=\"fill: #" + nodeColour + ";\" r=\"15\"/>\n")
		let eNode = SVG("<g></g>")

		eNodeBox.attr({x: 5, y: 5})
		eNodeIcon.attr({cx: 60, cy: 60})
		eNode.attr({transform: "translate(" + node.position.x*120 + "," + (c.length - node.position.z - 1)*120 + ")"})

		eNode.add(eNodeBox)
		eNode.add(eNodeIcon)
		eNodes.add(eNode)
	})
	eMicrocontroller.find("#Nodes").replace(eNodes)

	return {
		dimensions: { width: 1920, height: 1080 },
		data: fixSVG(cardTemplate.svg())
	}
}

hexToRgb = hex => {
	let res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec("#" + hex)
	return res ? {
		r: parseInt(res[1], 16),
		g: parseInt(res[2], 16),
		b: parseInt(res[3], 16)
	} : null
}

rgbToHsl = rgb => {
	let r = rgb.r / 255
	let g = rgb.g / 255
	let b = rgb.b / 255
	const l = Math.max(r, g, b)
	const s = l - Math.min(r, g, b)
	const h = s ? l === r ? (g - b) / s : l === g ? 2 + (b - r) / s : 4 + (r - g) / s : 0
	return {
		h: 60 * h < 0 ? 60 * h + 360 : 60 * h,
		s: s ? (l <= 0.5 ? s / (2 * l - s) : s / (2 - (2 * l - s))) : 0,
		l: (2 * l - s) / 2
	}
}

fixSVG = svg => {
	return svg.replaceAll(/svgjs:data="{.*?}"/gm, "").replace(/<svg.*?>/, "").replace(/<\/svg><\/svg>/, "</svg>")
}

wrapText = (text, sizeFunction, max) => {
	text = text.split(' ')

	let i = 0
	while (i < text.length - 1) {
		let s = text[i] + " " + text[i+1]
		if (sizeFunction(s) > max && ++i) continue
		text.splice(i, 2, s)
	}

	return text
}

wrapPartition = (elements, sizeFunction, spacing) => {

	let a = 0, b = elements.reduce((p, c) => p + sizeFunction(c)) + spacing * (elements.length - 1)
	let min = b

	for (let i = 0; i < elements.length; i++) {
		let s = sizeFunction(elements[i])
		a += s + (i === 0 ? 0 : spacing)
		b -= s + (i === (elements.length - 1) ? 0 : spacing)
		if (Math.max(a, b) > min) return { a: elements.slice(0, i), b: elements.slice(i, elements.length), i: i, min: min }
		min = Math.max(a, b);
	}

	return { a: elements, b: [], i: elements.length - 1, min: min }
}

module.exports = { genControllerThumbnail, genControllerCard, genGroupThumbnail }