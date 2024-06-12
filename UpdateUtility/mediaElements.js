fs = require("fs");
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
let layoutTemplate = SVG().svg(fs.readFileSync(mPath + "Templates/Layout.svg").toString())
let nodesTemplate = SVG().svg(fs.readFileSync(mPath + "Templates/Nodes.svg").toString())
let linkHigherTemplate = SVG().svg(fs.readFileSync(mPath + "Templates/LinkHigher.svg").toString())
let linkLowerTemplate = SVG().svg(fs.readFileSync(mPath + "Templates/LinkLower.svg").toString())
let controllerDescTemplate = fs.readFileSync(mPath + "Templates/ControllerDescription.txt").toString()
let groupCardTemplate = SVG().svg(fs.readFileSync(mPath + "Templates/GroupCard.svg").toString())
let groupDescTemplate = fs.readFileSync(mPath + "Templates/GroupDescription.txt").toString()


// text width calculations
getTextWidthFunction = font => options => text => textSVG.loadSync(mPath + 'Fonts/' + font).getMetrics(text, options).width
textWidth = {
	robotoLight: getTextWidthFunction('Roboto-Light.ttf'),
	robotoMedium: getTextWidthFunction('Roboto-Medium.ttf'),
	robotoBold: getTextWidthFunction('Roboto-Bold.ttf'),
	jetbrainsMonoMedium: getTextWidthFunction('JetBrainsMono-Medium.ttf')
}

/*
 * Elements
 */

genNode = (n, opt) => {

	opt = {
		layout: opt?.layout
	}

	let nodeColour = database.definitions.nodeColours[n.type]

	let eNodeBox = SVG("<rect " + (opt.layout ? "style=\"display: none\" " : "") + "class=\"cBack\" width=\"120\" height=\"120\" rx=\"20\" ry=\"20\"/>")
	let eNodeIcon = SVG(n.mode ? "<circle style=\"stroke-width: 10px; fill: " + (opt.layout ? "#e6e6e6" : "none") + "; stroke: #" + nodeColour + ";\"  r=\"25\"/>" : "<circle style=\"fill: #" + nodeColour + ";\" r=\"15\"/>\n")
	let eNodeConnections = SVG("<g></g>")
	let eNode = SVG("<g></g>")

	eNodeIcon.attr({cx: 60, cy: 60})

	if (opt.layout) for (let c in n.connections) eNodeConnections.add(SVG("<line class=\"layoutLine\" style=\"stroke: #" + nodeColour + "\" x1=\"60\" y1=\"60\" x2=\"" + (60 + decodeDir(c).x * 120 * n.connections[c]) + "\" y2=\"" + (60 + decodeDir(c).y * 120 * n.connections[c]) + "\"/>"))

	eNode.add(eNodeBox)
	eNode.add(eNodeConnections)
	eNode.add(eNodeIcon)

	return {
		dimensions: { width: 120, height: 120 },
		data: fixSVG(eNode.svg())
	}
}

genCompositeChannelInfo = (cid, opt) => {

	opt = {
		width: opt?.width ?? 795,
		mode: opt?.mode,
		visibility: opt?.visibility ?? 0
	}

	let eChannelInfo = SVG("<g></g>")

	let channels = resolveChannels(cid)

	let y = -22
	let render = type => {
		let eIDs = SVG("<text class=\"mono\" transform=\"translate(120 0)\" text-anchor=\"end\" style='fill: #" + database.definitions.nodeColours[type === "boolean" ? "0" : "1"] + "'></text>")
		let eLabels = SVG("<text class=\"description cDark\" transform=\"translate(150 0)\"></text>")

		let c = []
		for (let ch in channels[type]) c.push(mergeJSON(channels[type][ch], { channel: Number(ch) }))
		c = c.filter(v => (opt.mode ? v.visibility.in : v.visibility.out) > opt.visibility).sort(v => v.channel)

		//if (c.length > 0) y += 45
		eIDs.attr({y: y + 52})
		eIDs.font({leading: 1})
		eLabels.attr({y: y + 52})
		eLabels.font({leading: 1})

		let d = 0
		eIDs.text(id => eLabels.text(label => c.forEach(v => wrapText(v.label, textWidth.robotoMedium({fontSize: 35}), opt.width - 150).forEach((line, i) => {
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
		dimensions: { width: opt.width, height: y },
		data: fixSVG(eChannelInfo.svg())
	}
}

genNodeInfo = (n, opt) => {

	opt = {
		width: opt?.width ?? 795,
		visibility: opt?.visibility ?? 0
	}

	let eNode = SVG(genNode(n).data)
	let eInfo = SVG("<text class=\"mono cDark2\" transform=\"translate(150 42)\"></text>")
	let eLabel = SVG("<text class=\"heading cDark\" transform=\"translate(150 100)\"></text>")
	let eDescription = SVG("<text class=\"description cDark\" transform=\"translate(150 180)\"></text>")
	let eNodeInfo = SVG("<g></g>")

	// text & positioning
	eInfo.text((database.definitions.nodeTypes[n.type] + " " + database.definitions.nodeModes[n.mode]).toUpperCase())

	let y = 120

	let wLabel = wrapText(n.label, textWidth.robotoMedium({fontSize: 50}), opt.width - 150)
	eLabel.font({size: 60, leading: 1})
	eLabel.text(add => wLabel.forEach(line => add.tspan(line).newLine()))
	y += (wLabel.length-1) * 60

	let wDescription = wrapText(n.description, textWidth.robotoMedium({fontSize: 35}), opt.width - 150)
	if (wDescription.length > 0) y += 60
	eDescription.attr({y: y - 180})
	eDescription.font({size: 45, leading: 1})
	eDescription.text(add => wDescription.forEach(line => add.tspan(line).newLine()))
	y += Math.max(wDescription.length - 1, 0) * 45
	if (wDescription.length > 0) y += 10

	if (n.channels) {
		y += 40
		let channelInfo = genCompositeChannelInfo(n.channels, { width: opt.width, mode: n.mode, visibility: opt.visibility })
		let eChannelInfo = SVG(channelInfo.data)
		eChannelInfo.attr({transform: "translate(0 " + y + ")"})
		y += channelInfo.dimensions.height !== 0 ? channelInfo.dimensions.height : -40
		eNodeInfo.add(eChannelInfo)
	}

	eNodeInfo.add(eNode)
	eNodeInfo.add(eInfo)
	eNodeInfo.add(eLabel)
	eNodeInfo.add(eDescription)

	if (y < 120) console.log(n.label)

	return {
		dimensions: { width: opt.width, height: y },
		data: fixSVG(eNodeInfo.svg())
	}
}

genMicrocontroller = (c, opt) => {

	opt = {
		width: opt?.width ?? c.width,
		height: opt?.height ?? c.length,
		text: opt?.text ?? "",
		layoutType: opt?.layoutType
	}

	let rad = opt.layoutType ? 30 : 20
	let col = database.definitions.groupColours[c.group]

	let eMicrocontroller = SVG("<g transform=\"translate(0 0)\"></g>")
	let eBackground = SVG("<rect class=\"cBack\" x=\"0\" y=\"0\" rx=\"" + rad + "\" ry=\"" + rad + "\"/>")
	let eBorder = SVG("<rect class=\"cBack\" x=\"0\" y=\"0\" rx=\"" + rad + "\" ry=\"" + rad + "\"/>")
	let eNodes = SVG("<g></g>")
	let eText = SVG("<text class=\"mono cDark\" dominant-baseline=\"middle\" text-anchor=\"middle\"></text>")

	let size = {x: 0, y: 0, width: 120 * opt.width, height: 120 * opt.height}
	eBackground.attr(size)
	eBorder.attr(size)

	let wText = wrapText(opt?.text, textWidth.jetbrainsMonoMedium({fontSize: 30}), opt.width * 120 - 100)
	eText.attr({x: 60 * opt.width, y: 60 * opt.height - 40 * (wText.length - 1) / 2})
	eText.font({size: 40, leading: 1})
	eText.text(add => wText.forEach(line => add.tspan(line).newLine()))

	let nodes = []
	if (!opt.layoutType) nodes = c.nodes
	if ((opt.layoutType === "left" || opt.layoutType === "center") && (c.hierarchy.lower || c.group === "System"))
		nodes.push(
			c.name === "Main Controller" || c.readonly || c.type === "Interface" ? undefined : {mode: true, type: 5, position: {x: opt.width - 0.5, z: 0}, connections: {r: 0.5}},
			c.identifier === "[System] Hub" ? undefined : {mode: false, type: 5, position: {x: opt.width - 0.5, z: 1}, connections: {r: 1.5}}
		)
	if ((opt.layoutType === "right" || opt.layoutType === "center") && (c.hierarchy.higher || c.group === "System"))
		nodes.push(
			c.readonly || c.type === "Extender" ? undefined : {mode: false, type: 5, position: {x: -0.5, z: 0}, connections: {l: 1.5}},
			{mode: true, type: 5, position: {x: -0.5, z: 1}, connections: {l: 0.5}}
		)

	nodes.forEach(node => node ? eNodes.add(SVG(genNode(node, { layout: opt.layoutType }).data).attr({transform: "translate(" + node.position.x*120 + "," + (opt.height - node.position.z - 1)*120 + ")"})) : undefined)

	if (opt.layoutType) eBorder.attr({style:"fill:#" + col})
	else eBackground.attr({style: "stroke:#cacacc;stroke-width:20px;"})
	eBorder.attr({x: opt.layoutType === "left" ? -30 : opt.layoutType === "right" ? 30 : 0})

	eMicrocontroller.add(eBorder)
	eMicrocontroller.add(eBackground)
	eMicrocontroller.add(eNodes)
	eMicrocontroller.add(eText)

	return {
		dimensions: { width: size.width, height: size.height },
		data: fixSVG(eMicrocontroller.svg())
	}
}

genDescriptionComponent = (comp, x) => {
	switch (comp.charAt(0)) {
		case "a": return encodeURI(database.definitions.urls.images + "All/" + comp.substring(1) + ".png")
		case "c":
			return encodeURI(database.definitions.urls.images + comp.substring(1) + "/" + x.identifier + ".png")
		case "s":
			if (comp.substring(1) === "Links") {
				let gen = (list, type) => list?.map(c => "[url=https://steamcommunity.com/sharedfiles/filedetails/?id=" + database.controllers[c].publishedfileid + "][img]" + encodeURI(database.definitions.urls.images + "Link" + type + "/" + c + ".png") + "[/img][/url]") ?? []
				return gen(x.hierarchy?.higher, "Higher").concat(gen(x.hierarchy?.lower, "Lower")).reduce((r, c) => r + c + "\n", "")
			}
	}
	return "ERROR for placeholder: {$m" + comp + "}"
}

/*
 * Final Media
 */

genThumbLike = (o, template) => {

	// elements
	let eFrame = template.find("#Frame")
	let eName = template.find("#Name")
	let eType = template.find("#Type")
	let eArrow = template.find("#Arrow")

	// colour
	let colour = database.definitions.groupColours[o.group]
	eFrame.css({fill: "#" + colour})
	eType.attr({class: "type"})
	eArrow?.attr({class: ""})
	eType.addClass(rgbToHsl(hexToRgb(colour)).l > .5 ? "cDark" : "cLight")
	eArrow?.addClass(rgbToHsl(hexToRgb(colour)).l > .5 ? "cDark" : "cLight")

	// text
	let wName = wrapText(o.name, textWidth.robotoBold({fontSize: 80}), 392)
	eName.attr({y: -80 * (wName.length-1)})
	eName.font({size: 80, leading: 1})
	eName.text(add => wName.forEach(line => add.tspan(line).newLine()))
	eType.first().text(o.type)

	return {
		dimensions: { width: template.first().viewbox().width, height: template.first().viewbox().height },
		data: fixSVG(template.svg())
	}
}

// controller

genControllerThumbnail = c => {
	return genThumbLike({
		name: c.name,
		group: c.group,
		type: c.type
	}, thumbnailTemplate)
}

genControllerLink = (c, dir) => {
	return genThumbLike({
		name: c.name,
		group: c.group,
		type: c.type
	}, dir === "Higher" ? linkHigherTemplate : linkLowerTemplate)
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
	eMicrocontroller.replace(SVG(genMicrocontroller(c).data).id("Microcontroller").attr({transform: "translate(120 360)"}))

	return {
		dimensions: { width: 1920, height: 1080 },
		data: fixSVG(cardTemplate.svg())
	}
}

genControllerLayout = c => {

	// elements
	let eInfo = layoutTemplate.find("#Info")
	let eMCs = SVG("<g id=\"MCs\"></g>")
	let eLines = SVG("<g id=\"Lines\"></g>")

	let col = database.definitions.nodeColours["5"];

	// text
	eInfo.text(c.identifier + (c.version ? " v" + c.version : ""))

	let makeMC = (c, w, h, b, x, y) => eMCs.add(SVG(genMicrocontroller(c, {width: w, height: h, text: c.identifier, layoutType: b}).data).attr({transform: "translate(" + x + " " + y + ")"}))
	makeMC(c, 4, 2, "center", 720, 360);
	c.hierarchy.higher?.forEach((c, i) => makeMC(database.controllers[c], 3, 2, "left", 120, 360 * (i+1)))
	c.hierarchy.lower?.forEach((c, i) => makeMC(database.controllers[c], 3, 2, "right", 1440, 360 * (i+1)))

	let addLine = (x, y, l) => eLines.add(SVG("<line class=\"layoutLine\" style=\"stroke: #" + col + "\" x1=\"" + x + "\" y1=\"" + y + "\" x2=\"" + x + "\" y2=\"" + (y + l) + "\"/>"))
	if (c.hierarchy.higher && !c.readonly && c.type !== "Extender") addLine(540, 540, 360 * (c.hierarchy.higher.length - 1))
	if (c.hierarchy.higher && c.type !== "Module") addLine(660, 420, 360 * (c.hierarchy.higher.length - 1))
	if (c.hierarchy.lower && !c.readonly && c.type !== "Interface") addLine(1260, 540, 360 * (c.hierarchy.lower.length - 1))
	if (c.hierarchy.lower) addLine(1380, 420, 360 * (c.hierarchy.lower.length - 1))

	layoutTemplate.find("#MCs").replace(eMCs)
	layoutTemplate.find("#Lines").replace(eLines)

	return {
		dimensions: { width: 1920, height: 1080 },
		data: fixSVG(layoutTemplate.svg())
	}
}

genControllerNodes = c => {

	// elements
	let eFrame = nodesTemplate.find("#Frame")
	//let eBackground = nodesTemplate.find("#Background")
	//let eLogo = nodesTemplate.find("#TCPLogo")
	let eName = nodesTemplate.find("#Name")
	let eInfo = nodesTemplate.find("#Info")

	// text
	//eName.text(c.name)
	eInfo.text(c.identifier + (c.version ? " v" + c.version : ""))

	// nodes
	let nodeInfoWidth = 795
	let eNodes = SVG("<g id=\"Nodes\" transform=\"translate(120 360)\"></g>")
	let nodes = ([...c.nodes].sort((a, b) => a.type - b.type || b.mode - a.mode)).map(node => genNodeInfo(node, { width: nodeInfoWidth, visibility: 1 })) // sorting
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
	//eBackground.attr({height: height-60})
	//eLogo.attr({transform: "translate(0, " + (height - 1080) + ")"})

	return {
		dimensions: { width: 1920, height: 480 + wrap.min },
		data: fixSVG(nodesTemplate.svg())
	}
}

genControllerDesc = c => {

	let desc = controllerDescTemplate
	desc = placeholders(desc, c)

	return {
		data: desc
	}
}

// group

genGroupThumbnail = g => {
	return genThumbLike({
		name: g.name,
		group: g.name,
		type: "Group"
	}, thumbnailTemplate)
}

genGroupCard = g => {

	// elements
	let eFrame = groupCardTemplate.find("#Frame")
	let eName = groupCardTemplate.find("#Name")
	let eInfo = groupCardTemplate.find("#Info")
	let eDescription = groupCardTemplate.find("#Description")

	// colour
	let colour = database.definitions.groupColours[g.name]
	eFrame.css({fill: "#" + colour})

	// text
	let wDescription = wrapText(g.description ?? "", textWidth.robotoLight({fontSize: 35}), 1170)
	eDescription.font({size: 45, leading: 1})
	eDescription.text(add => wDescription.forEach(line => add.tspan(line).newLine()))
	eName.text(g.name)
	eInfo.text(g.identifier)

	return {
		dimensions: { width: 1920, height: 1080 },
		data: fixSVG(groupCardTemplate.svg())
	}
}

genGroupDesc = g => {



	return {
		data: "test"
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

decodeDir = dir => {
	switch (dir) {
		case "l": return {x: -1, y: 0}
		case "r": return {x: 1, y: 0}
		case "u": return {x: 0, y: 1}
		case "d": return {x: 0, y: -1}
	}
	return {x: 0, y: 0}
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