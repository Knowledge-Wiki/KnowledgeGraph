/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 * @credits https://github.com/OpenSemanticLab/mediawiki-extensions-InteractiveSemanticGraph
 */

KnowledgeGraph = function () {
	var Canvas = {};
	var Nodes = new vis.DataSet([]);
	var Edges = new vis.DataSet([]);
	var Data = {};
	var maxPropValueLength = 20;
	var Config;
	var Container;
	var Properties = {};
	var ModelProperties = {};
	var SelectedNode = null;
	var TmpData;
	var Network;

	function deleteNode(nodeId) {
		var children = Network.getConnectedNodes(nodeId);
		children = children.filter((x) => !(x in Data));
		children.push(nodeId);
		Nodes.remove(children);
	}

	function loadNodes(value) {
		var payload = {
			titles: value,
			depth: Config.depth,
			'only-properties': JSON.stringify(Config['only-properties']),
			action: 'knowledgegraph-load-nodes',
		};
		return new Promise((resolve, reject) => {
			mw.loader.using('mediawiki.api', function () {
				new mw.Api()
					.postWithToken('csrf', payload)
					.done(function (thisRes) {
						// console.log('thisRes', thisRes);
						if ('data' in thisRes[payload.action]) {
							var data_ = JSON.parse(thisRes[payload.action].data);
							Data = jQuery.extend(Data, data_);
							resolve(data_);
						} else {
							reject();
						}
					})
					.fail(function (thisRes) {
						// eslint-disable-next-line no-console
						console.error(payload.action, thisRes);
						reject(thisRes);
					});
			});
		});
	}

	function addNode(label) {
		if (Nodes.get(label) !== null) {
			return;
		}

		var nodeConfig = jQuery.extend(
			JSON.parse(JSON.stringify(Config.graphOptions.nodes)),
			label in Config.propertyOptions ? Config.propertyOptions[label] : {},
			{
				id: label,
				label: label,
				shape: 'box',
				font: { size: 30 },
				// title: 'sdds <ul> <li>a</ul>',
			}
		);

		if (!(label in Data)) {
			nodeConfig.color = 'red';
		}

		if (Data[label] === null) {
			nodeConfig.opacity = 0.5;
			nodeConfig.shapeProperties.borderDashes = [5, 5];
		}

		Nodes.add(nodeConfig);
	}

	function createNodes(data) {
		for (var label in data) {
			addNode(label);

			// not loaded
			if (data[label] === null) {
				continue;
			}

			for (var propLabel in data[label]) {
				if (
					propLabel in ModelProperties &&
					ModelProperties[propLabel].getValue() === false
				) {
					continue;
				}

				var color = randomHSL();
				var propLabel_ =
					propLabel +
					(!Config['show-property-type']
						? ''
						: ' (' + data[label][propLabel].typeLabel + ')');

				switch (data[label][propLabel].typeId) {
					case '_wpg':
						for (var label_ of data[label][propLabel].values) {
							var edgeConfig = jQuery.extend(
								JSON.parse(JSON.stringify(Config.graphOptions.edges)),
								{
									from: label,
									to: label_,
									label: propLabel_,
									// group: propLabel,
								}
							);

							edgeConfig.arrows.to.enabled = true;
							Edges.add(edgeConfig);
							addNode(label_);
						}

						break;
					// @TODO complete with other property types
					default:
						var valueId = uuidv4();

						Edges.add({
							from: label,
							to: valueId,
							label: propLabel_,
							// color: color,
							// group: propLabel,
						});

						var propValue = data[label][propLabel].values.join(', ');

						Nodes.add(
							jQuery.extend(
								propLabel in Config.propertyOptions
									? Config.propertyOptions[propLabel]
									: { color },
								{
									id: valueId,
									label:
										propValue.length <= maxPropValueLength
											? propValue
											: propValue.substr(0, maxPropValueLength) + ' ...',
								}
							)
						);
				}
			}
		}
	}

	function initialize(container, config) {
		console.log('config', config);

		Config = config;
		Container = container;

		$(container).width(config.width);
		$(container).height(config.width);

		if (config['show-toolbar']) {
			var toolbar = createToolbar();
			toolbar.$element.insertBefore(container);
		}

		var options = getDefaultOptions();

		Data = config.data;

		//create the network
		Network = new vis.Network(
			container,
			{ nodes: Nodes, edges: Edges },
			config.graphOptions
		);

		createNodes(Data);

		var self = this;

		Network.on('oncontext', function (params) {
			var nodeId = params.nodes[0];
			if (nodeId !== undefined && nodeId in Data) {
				params.event.preventDefault();
				Properties = Data[nodeId];
				openDialog(nodeId);
				return;
			}
			return;
			// openDialog(null);
			// Canvas = params.pointer.canvas;
		});

		Network.on('click', function (params) {
			if (!params.nodes.length) {
				return;
			}

			if (SelectedNode !== params.nodes[0]) {
				SelectedNode = params.nodes[0];
				return;
			}

			// var excludedIds = [params.nodes[0]];
			function HideNodesRec(nodeId) {
				var children = Network.getConnectedNodes(nodeId);
				// children = children.filter((x) => excludedIds.indexOf(x) === -1);

				var updateNodes = [];
				for (var nodeId_ of children) {
					if (!(nodeId_ in Data)) {
						updateNodes.push({
							id: nodeId_,
							hidden: !Nodes.get(nodeId_).hidden,
						});
					}
				}
				Nodes.update(updateNodes);
			}

			HideNodesRec(params.nodes[0]);
		});

		Network.on('doubleClick', function (params) {
			if (!params.nodes.length) {
				return;
			}
			var nodeId = params.nodes[0];

			if (!(nodeId in Data) || Data[nodeId] === null) {
				loadNodes(params.nodes[0]).then(function (data) {
					createNodes(data);

					Nodes.update([
						{
							id: nodeId,
							opacity: 1,
							shapeProperties: {
								borderDashes: false,
							},
						},
					]);
				});
			}
		});
	}

	function openDialog(nodeId) {
		// Create and append a window manager.
		var windowManager = new OO.ui.WindowManager();
		$(document.body).append(windowManager.$element);

		// @see https://www.mediawiki.org/wiki/OOUI/Windows/Process_Dialogs
		var myDialog = new MyDialog({
			size: 'medium',
		});

		windowManager.addWindows([myDialog]);

		windowManager.openWindow(myDialog, { nodeId, title: nodeId });
	}

	function MyDialog(config) {
		MyDialog.super.call(this, config);
	}
	OO.inheritClass(MyDialog, OO.ui.ProcessDialog);

	// Specify a name for .addWindows()
	MyDialog.static.name = 'myDialog';
	// Specify the static configurations: title and action set
	MyDialog.static.actions = [
		{
			flags: ['primary', 'progressive'],
			label: 'Continue',
			action: 'continue',
			modes: ['select'],
		},
		{
			action: 'back',
			label: 'Back',
			flags: ['safe', 'back'],
			modes: ['properties'],
		},
		{
			flags: ['primary', 'progressive'],
			label: 'Done',
			action: 'done',
			modes: ['properties'],
		},
		{
			flags: 'safe',
			label: 'Cancel',
			modes: ['select', 'properties', 'edit'],
		},
		{
			flags: ['primary', 'progressive'],
			label: 'Done',
			action: 'done',
			modes: ['edit'],
		},
		{
			action: 'delete',
			label: 'Delete',
			flags: 'destructive',
			modes: ['edit'],
		},
	];

	MyDialog.prototype.displayPropertiesSwitch = function (properties) {
		ModelProperties = {};
		var items = [];

		for (var i in Properties) {
			var toggleInput = new OO.ui.ToggleSwitchWidget({
				value: true,
			});

			ModelProperties[i] = toggleInput;

			var field = new OO.ui.FieldLayout(toggleInput, {
				label: i,
				help: '',
				helpInline: true,
				align: 'top',
			});
			items.push(field);
		}

		this.fieldset.addItems(items);
	};

	// Customize the initialize() function to add content and layouts:
	MyDialog.prototype.initialize = function () {
		MyDialog.super.prototype.initialize.call(this);

		var panelA = new OO.ui.PanelLayout({
			padded: true,
			expanded: false,
		});

		var content = new OO.ui.FieldsetLayout();

		this.titleInputWidget = new mw.widgets.TitleInputWidget({
			autocomplete: true,
			//	suggestions: true,
			//	addQueryInput: true,
			// $overlay: true,
			//	allowSuggestionsWhenEmpty: true,
		});
		var field = new OO.ui.FieldLayout(this.titleInputWidget, {
			label: 'Select an article with semantic properties',
			align: 'top',
		});

		content.addItems([field]);
		panelA.$element.append(content.$element);

		var panelB = new OO.ui.PanelLayout({
			padded: true,
			expanded: false,
		});

		this.fieldset = new OO.ui.FieldsetLayout({
			label:
				'toggle the properties that you would like to display on the network',
		});
		panelB.$element.append(this.fieldset.$element);

		this.stackLayout = new OO.ui.StackLayout({
			items: [panelA, panelB],
			continuous: false, // !hasMultiplePanels(),
			expanded: true,
			padded: false,
			// The following classes are used here:
			// * PanelPropertiesStack
			// * PanelPropertiesStack-empty
			// classes: classes
		});

		this.$body.append(this.stackLayout.$element);

		// this.urlInput.connect(this, { change: "onUrlInputChange" });
	};

	// Specify any additional functionality required by the window (disable opening an empty URL, in this case)
	// MyDialog.prototype.onUrlInputChange = function (value) {
	// 	this.actions.setAbilities({
	// 		open: !!value.length,
	// 	});
	// };

	// Specify the dialog height (or don't to use the automatically generated height).
	MyDialog.prototype.getBodyHeight = function () {
		// Note that "expanded: false" must be set in the panel's configuration for this to work.
		// When working with a stack layout, you can use:
		//   return this.panels.getCurrentItem().$element.outerHeight( true );
		//return this.stackLayout.getCurrentItem().$element.outerHeight(true);

		return 200;
	};

	// Use getSetupProcess() to set up the window with data passed to it at the time
	// of opening (e.g., url: 'http://www.mediawiki.org', in this example).
	MyDialog.prototype.getSetupProcess = function (data) {
		data = data || {};
		return MyDialog.super.prototype.getSetupProcess
			.call(this, data)
			.next(function () {
				if (data && data.nodeId) {
					SelectedNode = data.nodeId;
					this.initializePropertyPanel();
					this.actions.setMode('edit');
				} else {
					this.actions.setMode('select');
				}
			}, this);
	};

	MyDialog.prototype.initializePropertyPanel = function () {
		this.displayPropertiesSwitch();
		var panel = this.stackLayout.getItems()[1];
		this.stackLayout.setItem(panel);
	};

	// Specify processes to handle the actions.
	MyDialog.prototype.getActionProcess = function (action) {
		// console.log('action', action);
		// console.log('titleInputWidget', this.titleInputWidget.getValue());

		var selfDialog = this;
		switch (action) {
			case 'delete':
				if (confirm('Are you sure you want to delete this node ?')) {
					deleteNode(SelectedNode);
					return new OO.ui.Process(function () {
						selfDialog.close({ action: action });
					});
				}
				break;
			case 'done':
				createNodes(TmpData);
				return new OO.ui.Process(function () {
					selfDialog.close({ action: action });
				});
				break;
			case 'continue':
				return MyDialog.super.prototype.getActionProcess
					.call(this, action)
					.next(function () {
						return new Promise((resolve, reject) => {
							var title_ = selfDialog.titleInputWidget.getValue();
							loadNodes(title_).then(function (data) {
								Properties = data[Object.keys(data)[0]];
								TmpData = data;
								selfDialog.initializePropertyPanel();
								selfDialog.actions.setMode('properties');
								resolve();
							});
						});
					});
				break;

			case 'back':
				this.stackLayout.setItem(this.stackLayout.getItems()[0]);
				this.actions.setMode('select');
				break;
		}

		return MyDialog.super.prototype.getActionProcess.call(this, action);

		if (action === 'open') {
			// Create a new process to handle the action
			return new OO.ui.Process(function () {
				window.open(this.urlInput.getValue());
			}, this);
		}
		// Fallback to parent handler
		return MyDialog.super.prototype.getActionProcess.call(this, action);
	};

	// Use the getTeardownProcess() method to perform actions whenever the dialog is closed.
	// This method provides access to data passed into the window's close() method
	// or the window manager's closeWindow() method.
	MyDialog.prototype.getTeardownProcess = function (data) {
		return MyDialog.super.prototype.getTeardownProcess
			.call(this, data)
			.first(function () {
				// Perform any cleanup as needed
			}, this);
	};

	function createToolbar() {
		var toolFactory = new OO.ui.ToolFactory();
		var toolGroupFactory = new OO.ui.ToolGroupFactory();

		var toolbar = new OO.ui.Toolbar(toolFactory, toolGroupFactory, {
			actions: true,
		});

		var onSelect = function () {
			var toolName = this.getName();

			switch (toolName) {
				case 'add-node':
					openDialog(null);
					break;
				case 'nodes-by-property':
					break;

				case 'export-graph':
					break;
			}

			this.setActive(false);
		};

		var toolGroup = [
			{
				name: 'add-node',
				icon: 'add',
				title: 'add node',
				onSelect: onSelect,
			},
			// {
			// 	name: 'nodes-by-property',
			// 	icon: 'add',
			// 	title: 'add nodes by property',
			// 	onSelect: onSelect,
			// },
			{
				name: 'export-graph',
				icon: 'add',
				title: 'export graph',
				onSelect: onSelect,
			},
		];
		createToolGroup(toolFactory, 'group', toolGroup);

		toolbar.setup([
			{
				name: 'my-group',
				// type: "bar",
				// label: "Create property",
				include: [{ group: 'group' }],
			},
		]);

		return toolbar;
	}

	function getNestedProp(path, obj) {
		return path.reduce((xs, x) => (xs && xs[x] ? xs[x] : null), obj);
	}

	function createTool(obj, config) {
		var Tool = function () {
			// Tool.super.apply( this, arguments );
			Tool.super.call(this, arguments[0], config);

			OO.ui.mixin.PendingElement.call(this, {});

			if (getNestedProp(['data', 'disabled'], config)) {
				// this.setPendingElement(this.$element)
				// this.pushPending();
				this.setDisabled(true);
			}

			if (getNestedProp(['data', 'pending'], config)) {
				// this.setPendingElement(this.$element)
				this.pushPending();
			}

			// @see https://gerrit.wikimedia.org/r/plugins/gitiles/oojs/ui/+/c2805c7e9e83e2f3a857451d46c80231d1658a0f/demos/pages/toolbars.js
			this.toggled = false;
			if (config.init) {
				config.init.call(this);
			}
		};

		OO.inheritClass(Tool, OO.ui.Tool);
		OO.mixinClass(Tool, OO.ui.mixin.PendingElement);

		Tool.prototype.onSelect = function () {
			if (obj.onSelect) {
				obj.onSelect.call(this);
			} else {
				this.toggled = !this.toggled;
				this.setActive(this.toggled);
			}
			// Tool.emit( 'updateState' );
		};

		Tool.prototype.onUpdateState = function () {
			this.popPending();
			this.setDisabled(false);
		};

		for (var i in obj) {
			Tool.static[i] = obj[i];
		}

		Tool.static.displayBothIconAndLabel = true;

		return Tool;
	}

	function createToolGroup(toolFactory, groupName, tools) {
		tools.forEach(function (tool) {
			var obj = jQuery.extend({}, tool);
			obj.group = groupName;
			var config = tool.config ? tool.config : {};
			delete obj.config;
			toolFactory.register(createTool(obj, config));
		});
	}

	function getDefaultOptions() {
		var options = {
			autoResize: true,
			height: '100%',
			width: '100%',
			locale: 'en',
			// locales: locales,
			clickToUse: false,
			configure: {
				enabled: true,
				filter: 'nodes,edges',
				// container: undefined,
				showButton: true,
			},
			edges: {
				arrows: {
					to: {
						enabled: false,
						// imageHeight: undefined,
						// imageWidth: undefined,
						scaleFactor: 1,
						// src: undefined,
						type: 'arrow',
					},
					middle: {
						enabled: false,
						imageHeight: 32,
						imageWidth: 32,
						scaleFactor: 1,
						src: 'https://visjs.org/images/visjs_logo.png',
						type: 'image',
					},
					from: {
						enabled: false,
						// imageHeight: undefined,
						// imageWidth: undefined,
						scaleFactor: 1,
						// src: undefined,
						type: 'arrow',
					},
				},
				endPointOffset: {
					from: 0,
					to: 0,
				},
				arrowStrikethrough: true,
				chosen: true,
				color: {
					color: '#848484',
					highlight: '#848484',
					hover: '#848484',
					inherit: 'from',
					opacity: 1.0,
				},
				dashes: false,
				font: {
					color: '#343434',
					size: 14, // px
					face: 'arial',
					background: 'none',
					strokeWidth: 2, // px
					strokeColor: '#ffffff',
					align: 'horizontal',
					multi: false,
					vadjust: 0,
					bold: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'bold',
					},
					ital: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'italic',
					},
					boldital: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'bold italic',
					},
					mono: {
						color: '#343434',
						size: 15, // px
						face: 'courier new',
						vadjust: 2,
						mod: '',
					},
				},
				hidden: false,
				hoverWidth: 1.5,
				label: undefined,
				labelHighlightBold: true,
				length: undefined,
				physics: true,
				scaling: {
					min: 1,
					max: 15,
					label: {
						enabled: true,
						min: 14,
						max: 30,
						maxVisible: 30,
						drawThreshold: 5,
					},
					customScalingFunction: function (min, max, total, value) {
						if (max === min) {
							return 0.5;
						} else {
							var scale = 1 / (max - min);
							return Math.max(0, (value - min) * scale);
						}
					},
				},
				selectionWidth: 1,
				selfReferenceSize: 20,
				selfReference: {
					size: 20,
					angle: Math.PI / 4,
					renderBehindTheNode: true,
				},
				shadow: {
					enabled: false,
					color: 'rgba(0,0,0,0.5)',
					size: 10,
					x: 5,
					y: 5,
				},
				smooth: {
					enabled: true,
					type: 'dynamic',
					roundness: 0.5,
				},
				title: undefined,
				value: undefined,
				width: 1,
				widthConstraint: false,
			},

			nodes: {
				borderWidth: 1,
				borderWidthSelected: 2,
				brokenImage: undefined,
				chosen: true,
				color: {
					border: '#2B7CE9',
					background: '#97C2FC',
					highlight: {
						border: '#2B7CE9',
						background: '#D2E5FF',
					},
					hover: {
						border: '#2B7CE9',
						background: '#D2E5FF',
					},
				},
				opacity: 1,
				fixed: {
					x: false,
					y: false,
				},
				font: {
					color: '#343434',
					size: 14, // px
					face: 'arial',
					background: 'none',
					strokeWidth: 0, // px
					strokeColor: '#ffffff',
					align: 'center',
					multi: false,
					vadjust: 0,
					bold: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'bold',
					},
					ital: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'italic',
					},
					boldital: {
						color: '#343434',
						size: 14, // px
						face: 'arial',
						vadjust: 0,
						mod: 'bold italic',
					},
					mono: {
						color: '#343434',
						size: 15, // px
						face: 'courier new',
						vadjust: 2,
						mod: '',
					},
				},
				group: undefined,
				heightConstraint: false,
				hidden: false,
				icon: {
					face: 'FontAwesome',
					// code: undefined,
					// weight: undefined,
					size: 50, //50,
					color: '#2B7CE9',
				},
				// image: undefined,
				imagePadding: {
					left: 0,
					top: 0,
					bottom: 0,
					right: 0,
				},
				label: undefined,
				labelHighlightBold: true,
				level: undefined,
				mass: 1,
				physics: true,
				scaling: {
					min: 10,
					max: 30,
					label: {
						enabled: false,
						min: 14,
						max: 30,
						maxVisible: 30,
						drawThreshold: 5,
					},
					customScalingFunction: function (min, max, total, value) {
						if (max === min) {
							return 0.5;
						} else {
							var scale = 1 / (max - min);
							return Math.max(0, (value - min) * scale);
						}
					},
				},
				shadow: {
					enabled: false,
					color: 'rgba(0,0,0,0.5)',
					size: 10,
					x: 5,
					y: 5,
				},
				shape: 'ellipse',
				shapeProperties: {
					borderDashes: false, // only for borders
					borderRadius: 6, // only for box shape
					interpolation: false, // only for image and circularImage shapes
					useImageSize: false, // only for image and circularImage shapes
					useBorderWithImage: false, // only for image shape
					coordinateOrigin: 'center', // only for image and circularImage shapes
				},
				size: 25,
				title: undefined,
				value: undefined,
				widthConstraint: false,
				// x: undefined,
				// y: undefined,
			},
			groups: {
				useDefaultGroups: true,
				myGroupId: {
					/*node options*/
				},
			},
			layout: {
				randomSeed: undefined,
				improvedLayout: true,
				clusterThreshold: 150,
				hierarchical: {
					enabled: false,
					levelSeparation: 150,
					nodeSpacing: 100,
					treeSpacing: 200,
					blockShifting: true,
					edgeMinimization: true,
					parentCentralization: true,
					direction: 'UD', // UD, DU, LR, RL
					sortMethod: 'hubsize', // hubsize, directed
					shakeTowards: 'leaves', // roots, leaves
				},
			},
			interaction: {
				dragNodes: true,
				dragView: true,
				hideEdgesOnDrag: false,
				hideEdgesOnZoom: false,
				hideNodesOnDrag: false,
				hover: false,
				hoverConnectedEdges: true,
				keyboard: {
					enabled: false,
					speed: { x: 10, y: 10, zoom: 0.02 },
					bindToWindow: true,
					autoFocus: true,
				},
				multiselect: false,
				navigationButtons: false,
				selectable: true,
				selectConnectedEdges: true,
				tooltipDelay: 300,
				zoomSpeed: 1,
				zoomView: true,
			},
			manipulation: {
				enabled: false,
				initiallyActive: false,
				addNode: true,
				addEdge: true,
				// editNode: undefined,
				editEdge: true,
				deleteNode: true,
				deleteEdge: true,
				controlNodeStyle: {
					// all node options are valid.
				},
			},
			physics: {
				enabled: true,
				barnesHut: {
					theta: 0.5,
					gravitationalConstant: -2000,
					centralGravity: 0.3,
					springLength: 95,
					springConstant: 0.04,
					damping: 0.09,
					avoidOverlap: 0,
				},
				forceAtlas2Based: {
					theta: 0.5,
					gravitationalConstant: -50,
					centralGravity: 0.01,
					springConstant: 0.08,
					springLength: 100,
					damping: 0.4,
					avoidOverlap: 0,
				},
				repulsion: {
					centralGravity: 0.2,
					springLength: 200,
					springConstant: 0.05,
					nodeDistance: 100,
					damping: 0.09,
				},
				hierarchicalRepulsion: {
					centralGravity: 0.0,
					springLength: 100,
					springConstant: 0.01,
					nodeDistance: 120,
					damping: 0.09,
					avoidOverlap: 0,
				},
				maxVelocity: 50,
				minVelocity: 0.1,
				solver: 'barnesHut',
				stabilization: {
					enabled: true,
					iterations: 1000,
					updateInterval: 100,
					onlyDynamicEdges: false,
					fit: true,
				},
				timestep: 0.5,
				adaptiveTimestep: true,
				wind: { x: 0, y: 0 },
			},
		};
		return options;
	}

	function uuidv4() {
		return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
			(
				c ^
				(crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
			).toString(16)
		);
	}

	function randomHSL() {
		var golden = 0.618033988749895;
		var h = Math.random() + golden;
		h %= 1;
		return 'hsla(' + 360 * h + ',' + '70%,' + '80%,1)';
	}

	return {
		initialize,
		getDefaultOptions,
	};
};

$(document).ready(async function () {
	var semanticGraphs = JSON.parse(mw.config.get('knowledgegraphs'));

	async function getModule(str) {
		var module = await import(`data:text/javascript;base64,${btoa(str)}`);
		if ('default' in module) {
			return module.default;
		}
		return null;
	}

	$('.KnowledgeGraph').each(async function (index) {
		var graphData = semanticGraphs[index];

		if (graphData.graphOptions && Object.keys(graphData.graphOptions).length) {
			var result = await getModule(graphData.graphOptions);
			if (result) {
				graphData.graphOptions = result;
			}
		}

		if (
			graphData.propertyOptions &&
			Object.keys(graphData.propertyOptions).length
		) {
			for (var i in graphData.propertyOptions) {
				var result = await getModule(graphData.propertyOptions[i]);
				if (result) {
					graphData.propertyOptions[i] = result;
				}
			}
		}

		var config = $.extend(
			{
				data: {},
				graphOptions: new KnowledgeGraph().getDefaultOptions(),
				propertyOptions: {},
				'only-properties': [],
				'nodes-by-properties': {},
				depth: '',
				width: '',
				height: '',
				'show-toolbar': false,
				'show-property-type': false,
			},
			graphData
		);

		if (config.width !== '') {
			graphData.graphOptions.width = config.width;
		}
		if (config.height !== '') {
			graphData.graphOptions.height = config.height;
		}

		var graph = new KnowledgeGraph();
		graph.initialize(this, config);
	});
});
