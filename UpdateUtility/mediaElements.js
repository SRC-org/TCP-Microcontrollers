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
let nodesTemplate = SVG().svg(fs.readFileSync(mPath + "Templates/Nodes.svg").toString())

// text width calculations
getTextWidthFunction = font => options => text => textSVG.loadSync(mPath + 'Fonts/' + font).getMetrics(text, options).width
textWidth = {
	robotoLight: getTextWidthFunction('Roboto-Light.ttf'),
	robotoMedium: getTextWidthFunction('Roboto-Medium.ttf'),
	robotoBold: getTextWidthFunction('Roboto-Bold.ttf')
}

/*
 * Elements
 */

genNode = n => {
	let nodeColour = database.definitions.nodeColours[n.type]

	let eNodeBox = SVG("<rect class=\"cBack nodeBox\" width=\"110\" height=\"110\" rx=\"15\" ry=\"15\"/>")
	let eNodeIcon = SVG(n.mode ? "<circle style=\"stroke-width: 10px; fill: none; stroke: #" + nodeColour + ";\"  r=\"25\"/>" : "<circle style=\"fill: #" + nodeColour + ";\" r=\"15\"/>\n")
	let eNode = SVG("<g></g>")

	eNodeBox.attr({x: 5, y: 5})
	eNodeIcon.attr({cx: 60, cy: 60})

	eNode.add(eNodeBox)
	eNode.add(eNodeIcon)

	return {
		dimensions: { width: 120, height: 120 },
		data: fixSVG(eNode.svg())
	}
}

genCompositeChannelInfo = (cid, w) => {

	let eChannelInfo = SVG("<g></g>")

	let channels = resolveChannels(cid)

	let y = -22
	let render = type => {
		let eIDs = SVG("<text class=\"mono\" transform=\"translate(120 0)\" text-anchor=\"end\" style='fill: #" + database.definitions.nodeColours[type === "boolean" ? "0" : "1"] + "'></text>")
		let eLabels = SVG("<text class=\"description cDark\" transform=\"translate(150 0)\"></text>")

		let c = []
		for (let ch in channels[type]) c.push(mergeJSON(channels[type][ch], { channel: Number(ch) }))
		c = c.filter(v => v.visibility > 1).sort(v => v.channel)

		//if (c.length > 0) y += 45
		eIDs.attr({y: y + 52})
		eIDs.font({leading: 1})
		eLabels.attr({y: y + 52})
		eLabels.font({leading: 1})

		let d = 0
		eIDs.text(id => eLabels.text(label => c.forEach(v => wrapText(v.label, textWidth.robotoMedium({fontSize: 35}), w - 150).forEach((line, i) => {
			let d = i === 0 ? 52 : 45
			eIDs.font({size: d})
			eLabels.font({size: d})
			id.tspan(i === 0 ? type.charAt(0).toUpperCase() + String(v.channel).padStart(2, '0') : "").newLine()
			label.tspan(line).newLine()
			y += d
		}))))

		eChannelInfo.add(eIDs)
		eChannelInfo.add(eLabels)
	}

	render("boolean")
	render("number")
	y = Math.max(y + 10, 0)

	return {
		dimensions: { width: w, height: y },
		data: fixSVG(eChannelInfo.svg())
	}
}

genNodeInfo = (n, w) => {

	let eNode = SVG(genNode(n).data)
	let eInfo = SVG("<text class=\"mono cDark2\" transform=\"translate(150 42)\"></text>")
	let eLabel = SVG("<text class=\"heading cDark\" transform=\"translate(150 100)\"></text>")
	let eDescription = SVG("<text class=\"description cDark\" transform=\"translate(150 180)\"></text>")
	let eNodeInfo = SVG("<g></g>")

	// text & positioning
	eInfo.text((database.definitions.nodeTypes[n.type] + " " + database.definitions.nodeModes[n.mode]).toUpperCase())

	let y = 120

	let wLabel = wrapText(n.label, textWidth.robotoMedium({fontSize: 50}), w - 150)
	eLabel.font({size: 60, leading: 1})
	eLabel.text(add => wLabel.forEach(line => add.tspan(line).newLine()))
	y += (wLabel.length-1) * 60

	let wDescription = wrapText(n.description, textWidth.robotoMedium({fontSize: 35}), w - 150)
	if (wDescription.length > 0) y += 60
	eDescription.attr({y: y - 180})
	eDescription.font({size: 45, leading: 1})
	eDescription.text(add => wDescription.forEach(line => add.tspan(line).newLine()))
	y += Math.max(wDescription.length - 1, 0) * 45
	if (wDescription.length > 0) y += 10

	if (n.channels) {
		y += 40
		let channelInfo = genCompositeChannelInfo(n.channels, w)
		let eChannelInfo = SVG(channelInfo.data)
		eChannelInfo.attr({transform: "translate(0 " + y + ")"})
		y += channelInfo.dimensions.height
		eNodeInfo.add(eChannelInfo)
	}

	eNodeInfo.add(eNode)
	eNodeInfo.add(eInfo)
	eNodeInfo.add(eLabel)
	eNodeInfo.add(eDescription)

	if (y < 120) console.log(n.label)

	return {
		dimensions: { width: w, height: y },
		data: fixSVG(eNodeInfo.svg())
	}
}

/*
 * Final Media
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
	eName.attr({y: -80 * (wName.length-1)})
	eName.font({size: 80, leading: 1})
	eName.text(add => wName.forEach(line => add.tspan(line).newLine()))
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
		type: "Group"
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
	eDescription.font({size: 45, leading: 1})
	eDescription.text(add => wrapText(c.description, textWidth.robotoLight({fontSize: 35}), 840).forEach(line => add.tspan(line).newLine()))
	eTitleNext.text("Next" + (c.readonly ? " (Readonly)" : ""))

	// microcontroller
	//eMicrocontroller.attr({transform: "translate(120 360)"})
	let size = {/*x: 0, y: 0, */width: 120 * c.width, height: 120 * c.length}
	eMCBackground.attr(size)
	eMCBorder.attr(size)

	// nodes
	let eNodes = SVG("<g id=\"Nodes\"></g>")
	c.nodes.map(node => eNodes.add(SVG(genNode(node).data).attr({transform: "translate(" + node.position.x*120 + "," + (c.length - node.position.z - 1)*120 + ")"})))
	eMicrocontroller.find("#Nodes").replace(eNodes)

	return {
		dimensions: { width: 1920, height: 1080 },
		data: fixSVG(cardTemplate.svg())
	}
}

genControllerNodes = c => {

	// elements
	let eFrame = nodesTemplate.find("#Frame")
	let eBackground = nodesTemplate.find("#Background")
	//let eLogo = nodesTemplate.find("#TCPLogo")
	let eName = nodesTemplate.find("#Name")
	let eInfo = nodesTemplate.find("#Info")

	// text
	//eName.text(c.name)
	eInfo.text(c.identifier + (c.version ? " v" + c.version : ""))

	// nodes
	let nodeInfoWidth = 795
	let eNodes = SVG("<g id=\"Nodes\" transform=\"translate(120 360)\"></g>")
	let nodes = ([...c.nodes].sort((a, b) => a.type - b.type || b.mode - a.mode)).map(node => genNodeInfo(node, nodeInfoWidth)) // sorting
	let wrap = wrapPartition(nodes, node => node.dimensions.height, 90)

	let y = 0, x = 0
	nodes.forEach((node, i) => {
		if (i === wrap.i) {
			x = nodeInfoWidth + (1680 - 2 * nodeInfoWidth)
			y = 0
		}
		eNodes.add(SVG(node.data).attr({transform: "translate(" + x + " " + y + ")"}))
		y += node.dimensions.height + 90
	})
	nodesTemplate.find("#Nodes").replace(eNodes)

	// resize
	let height = 480 + wrap.min
	nodesTemplate.first().viewbox(0, 0, 1920, height)
	eFrame.attr({height: height})
	eBackground.attr({height: height-60})
	//eLogo.attr({transform: "translate(0, " + (height - 1080) + ")"})

	return {
		dimensions: { width: 1920, height: 480 + wrap.min },
		data: fixSVG(nodesTemplate.svg())
	}
}

/*
 * Helper Functions
 */

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
	if (text === "") return []
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
	let a = 0, b = elements.map(e => sizeFunction(e)).reduce((a, b) => a + b) + spacing * (elements.length - 1)
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

module.exports = { genControllerThumbnail, genControllerCard, genControllerNodes, genGroupThumbnail, genCompositeChannelInfo }