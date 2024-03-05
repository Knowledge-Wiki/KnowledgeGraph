/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 * @credits https://github.com/OpenSemanticLab/mediawiki-extensions-InteractiveSemanticGraph
 */

KnowledgeGraph = function () {
	var Canvas = {};
	var Nodes;
	var Edges;
	var Data = {};
	var maxPropValueLength = 20;
	var Config;
	var Container;
	var Properties = {};
	// var ModelProperties = {};
	var SelectedNode = null;
	var TmpData;
	var Network;
	var PopupMenuId = 'knowledgegraphp-popup-menu';
	var InitialData;
	var ContainerOptions;

	function deleteNode(nodeId) {
		var children = Network.getConnectedNodes(nodeId);
		children = children.filter(
			(x) => !(x in Data) || Network.getConnectedNodes(x).length === 1
		);
		children.push(nodeId);

		for (var nodeId of children) {
			Edges.remove(Network.getConnectedEdges(nodeId));
		}
		Nodes.remove(children);
		for (var nodeId of children) {
			delete Data[nodeId];
		}
	}

	function loadNodes(obj) {
		if (obj.title !== null) {
			var payload = {
				titles: obj.title,
				depth: Config.depth,
				'only-properties': JSON.stringify(Config['only-properties']),
				action: 'knowledgegraph-load-nodes',
			};
		} else {
			var payload = {
				properties: obj.properties.join('|'),
				action: 'knowledgegraph-load-properties',
			};
		}

		return new Promise((resolve, reject) => {
			mw.loader.using('mediawiki.api', function () {
				new mw.Api()
					.postWithToken('csrf', payload)
					.done(function (thisRes) {
						console.log('thisRes', thisRes);
						if ('data' in thisRes[payload.action]) {
							var data_ = JSON.parse(thisRes[payload.action].data);
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
		}).catch((err) => {
			console.log('err', err);
		});
	}

	function createHTMLTitle(label) {
		var fieldset = new OO.ui.FieldsetLayout({
			label: label,
		});

		var items = [];

		var linkButton = new OO.ui.ButtonWidget({
			label: 'open',
			icon: 'link',
			flags: [],
		});

		items.push(linkButton);

		var deleteButton = new OO.ui.ButtonWidget({
			label: 'open',
			icon: 'trash',
			flags: ['destructive'],
		});

		items.push(deleteButton);

		fieldset.addItems(items);

		var panel = new OO.ui.PanelLayout({
			padded: true,
			expanded: false,
		});

		panel.$element.append(fieldset.$element);

		return panel.$element.get(0);
	}

	function addNode(data, label) {
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

				// https://visjs.github.io/vis-network/examples/network/other/popups.html
				// title: createHTMLTitle(label),
			}
		);

		if (!(label in data)) {
			nodeConfig.color = 'red';
		}

		if (data[label] === null) {
			nodeConfig.opacity = 0.5;
			nodeConfig.shapeProperties.borderDashes = [5, 5];
		}

		Nodes.add(nodeConfig);
	}

	function createNodes(data) {
		for (var label in data) {
			if (label in Data && Data[label] !== null) {
				continue;
			}

			addNode(data, label);

			// not loaded
			if (data[label] === null) {
				continue;
			}

			// i is property Article title
			for (var i in data[label]) {
				// if (
				// 	propLabel in ModelProperties &&
				// 	ModelProperties[propLabel].getValue() === false
				// ) {
				// 	continue;
				// }

				var color = randomHSL();

				var propLabel =
					(data[label][i].preferredLabel !== ''
						? data[label][i].preferredLabel
						: data[label][i].canonicalLabel) +
					(!Config['show-property-type']
						? ''
						: ' (' + data[label][i].typeLabel + ')');

				switch (data[label][i].typeId) {
					case '_wpg':
						for (var label_ of data[label][i].values) {
							var edgeConfig = jQuery.extend(
								JSON.parse(JSON.stringify(Config.graphOptions.edges)),
								{
									from: label,
									to: label_,
									label: propLabel,
									group: label,
								}
							);

							edgeConfig.arrows.to.enabled = true;
							Edges.add(edgeConfig);
							addNode(data, label_);
						}

						break;
					// @TODO complete with other property types
					default:
						var valueId = `${i}#${uuidv4()}`;

						Edges.add({
							from: label,
							to: valueId,
							label: propLabel,
							group: label,
						});

						var propValue = data[label][i].values.join(', ');

						Nodes.add(
							jQuery.extend(
								data[label].preferredLabel in Config.propertyOptions
									? Config.propertyOptions[data[label].preferredLabel]
									: data[label].canonicalLabel in Config.propertyOptions
										? Config.propertyOptions[data[label].canonicalLabel]
										: { color },
								{
									id: valueId,
									label:
										propValue.length <= maxPropValueLength
											? propValue
											: propValue.substring(0, maxPropValueLength) + '…',
								}
							)
						);
				}
			}
		}

		Data = jQuery.extend(Data, data);
	}

	function ContextMenu(config) {
		var el = document.getElementById(PopupMenuId);
		if (el) {
			el.remove();
		}
		var el = document.createElement('div');
		el.id = PopupMenuId;
		el.className = config.className;

		var html = '';
		var ul = document.createElement('ul');
		el.append(ul);

		for (var item of config.items) {
			var li = document.createElement('li');
			var span = document.createElement('span');
			span.className =
				'oo-ui-iconElement oo-ui-iconElement-icon oo-ui-labelElement-invisible oo-ui-iconWidget oo-ui-icon-' +
				item.icon;
			li.append(span);
			var textNode = document.createTextNode(item.label);
			li.append(textNode);
			li.addEventListener('click', item.onClick);
			ul.append(li);
		}

		$(document).click(function () {
			var el = document.getElementById(PopupMenuId);
			if (el) {
				el.remove();
			}
		});

		$('#' + PopupMenuId).click(function (e) {
			e.stopPropagation();
			return false;
		});
		this.el = el;
	}

	ContextMenu.prototype.showAt = function (x, y) {
		this.el.style.left = x + 'px';
		this.el.style.top = y + 'px';
		document.body.appendChild(this.el);
	};

	function isObject(obj) {
		return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
	}

	function initialize(container, containerToolbar, containerOptions, config) {
		console.log('config', config);

		InitialData = JSON.parse(JSON.stringify(config.data));
		Config = config;
		Container = container;
		ContainerOptions = containerOptions;

		$(container).width(config.width);
		$(container).height(config.width);

		if (config['show-toolbar']) {
			var toolbar = createToolbar();
			// toolbar.$element.insertBefore(container);
			toolbar.$element.appendTo(containerToolbar);
		}

		Data = {};
		Nodes = new vis.DataSet([]);
		Edges = new vis.DataSet([]);

		Network = new vis.Network(
			Container,
			{ nodes: Nodes, edges: Edges },
			Config.graphOptions
		);

		if (config['show-toolbar']) {
			Config.graphOptions.configure.enabled = false;

			var messageWidget = new OO.ui.MessageWidget({
				type: 'info',
				//  mw.msg(
				label: new OO.ui.HtmlSnippet(
					'Press the button below and copy/paste the contents of the "nodes" and "edges" keys in an article <a target="_blank" href="' +
						mw.config
							.get('wgArticlePath')
							.replace('$1', 'MediaWiki:KnowledgeGraphOptions') +
						'">like this</a>. Then set it as value of the "graph-options" or "property-options?[Property label] parameters of the KnowledgeGraph\'s parser-function'
				),
				invisibleLabel: false,
				// classes:
			});

			$(containerOptions)
				.find('.vis-configuration.vis-config-option-container')
				.prepend(messageWidget.$element);

			$(ContainerOptions).toggle(false);
		}

		createNodes(Config.data);

		Network.on('oncontext', function (params) {
			params.event.preventDefault();

			var nodeId = params.nodes[0];
			//  && nodeId in Data
			if (nodeId !== undefined) {
				// console.log('params', params);

				var menuObj = {
					items: [
						{
							// mw.msg
							label: 'open article',
							icon: 'link',
							onClick: function () {
								var hashIndex = nodeId.indexOf('#');
								var url = mw.config
									.get('wgArticlePath')
									.replace(
										'$1',
										hashIndex !== -1 ? nodeId.substring(0, hashIndex) : nodeId
									);
								window.open(url, '_blank').focus();
							},
						},
					],
					className: 'KnowledgeGraphPopupMenu',
				};

				if (Config['show-toolbar'] === true) {
					menuObj.items.push({
						// mw.msg
						label: 'delete node',
						icon: 'trash',
						onClick: function () {
							// mw.msg
							if (confirm('Are you sure you want to delete this node ?')) {
								deleteNode(nodeId);
							}
						},
					});
				}

				PopupMenu = new ContextMenu(menuObj);
				PopupMenu.showAt(params.event.pageX, params.event.pageY);
			}
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
				loadNodes({ title: params.nodes[0] }).then(function (data) {
					// console.log('data', data);
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
		Properties = {};
		TmpData = {};

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
	// OO.inheritClass(MyDialog, OO.ui.Dialog);

	// Specify a name for .addWindows()
	MyDialog.static.name = 'myDialog';
	// Specify the static configurations: title and action set
	MyDialog.static.actions = [
		{
			flags: ['primary', 'progressive'],
			// mw.msg
			label: 'Continue',
			action: 'continue',
			modes: ['select'],
		},
		{
			action: 'back',
			// mw.msg
			label: 'Back',
			flags: ['safe', 'back'],
			modes: ['show-results', 'no-results', 'existing-node'],
		},
		{
			flags: ['primary', 'progressive'],
			// mw.msg
			label: 'Done',
			action: 'done',
			modes: ['show-results'],
		},
		{
			flags: 'safe',
			// mw.msg
			label: 'Cancel',
			modes: ['select', 'no-results', 'show-results', 'existing-node', 'edit'],
		},
		{
			flags: ['primary', 'progressive'],
			// mw.msg
			label: 'Done',
			action: 'done',
			modes: ['edit'],
		},
		{
			action: 'delete',
			// mw.msg
			label: 'Delete',
			flags: 'destructive',
			modes: ['edit'],
		},
	];

	// Customize the initialize() function to add content and layouts:
	MyDialog.prototype.initialize = function () {
		MyDialog.super.prototype.initialize.call(this);

		var self = this;

		var panelA = new OO.ui.PanelLayout({
			padded: true,
			expanded: true,
		});

		var indexLayout = new OO.ui.IndexLayout({
			framed: true,
			showMenu: false,
			expanded: true,
			padded: false,
			autoFocus: false,
		});

		function TabPanelOneLayout(name, config) {
			TabPanelOneLayout.super.call(this, name, config);

			var fieldsetLayout = new OO.ui.FieldsetLayout();

			self.titleInputWidget = new mw.widgets.TitleInputWidget({
				autocomplete: true,
				// suggestions: true,
				// addQueryInput: true,
				// $overlay: true,
				// allowSuggestionsWhenEmpty: true,
			});
			var field = new OO.ui.FieldLayout(self.titleInputWidget, {
				// mw.msg
				label: 'Select an article with semantic properties',
				align: 'top',
			});

			fieldsetLayout.addItems([field]);

			this.$element.append(fieldsetLayout.$element);
		}
		OO.inheritClass(TabPanelOneLayout, OO.ui.TabPanelLayout);
		TabPanelOneLayout.prototype.setupTabItem = function () {
			// mw.msg
			this.tabItem.setLabel('By article');
		};

		function TabPanelTwoLayout(name, config) {
			TabPanelTwoLayout.super.call(this, name, config);
			var fieldsetLayout = new OO.ui.FieldsetLayout();

			self.propertiesInputWidget = new mw.widgets.TitlesMultiselectWidget({
				autocomplete: true,
				namespace: 102,
				// suggestions: true,
				// addQueryInput: true,
				// $overlay: true,
				// allowSuggestionsWhenEmpty: true,
			});
			var field = new OO.ui.FieldLayout(self.propertiesInputWidget, {
				// mw.msg
				label: 'Select one or more properties',
				align: 'top',
				// helpInline: true,
				// help: 'Type an article title in the "MediaWiki" namespace',
			});

			fieldsetLayout.addItems([field]);

			this.$element.append(fieldsetLayout.$element);
		}
		OO.inheritClass(TabPanelTwoLayout, OO.ui.TabPanelLayout);
		TabPanelTwoLayout.prototype.setupTabItem = function () {
			// mw.msg
			this.tabItem.setLabel('By properties');
		};

		var tabPanel1 = new TabPanelOneLayout('by-article'),
			tabPanel2 = new TabPanelTwoLayout('by-properties');

		indexLayout.addTabPanels([tabPanel1, tabPanel2]);

		this.indexLayout = indexLayout;

		panelA.$element.append(indexLayout.$element);

		var panelB = new OO.ui.PanelLayout({
			padded: true,
			expanded: false,
		});

		// this.fieldset = new OO.ui.FieldsetLayout({
		// 	label:
		// 		'toggle the properties that you would like to display on the network',
		// });
		// panelB.$element.append(this.fieldset.$element);

		this.panelB = panelB;

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

	MyDialog.prototype.getBodyHeight = function () {
		// Note that "expanded: false" must be set in the panel's configuration for this to work.
		// When working with a stack layout, you can use:
		//   return this.panels.getCurrentItem().$element.outerHeight( true );
		//return this.stackLayout.getCurrentItem().$element.outerHeight(true);
		return 200;
	};

	MyDialog.prototype.getSetupProcess = function (data) {
		data = data || {};
		return MyDialog.super.prototype.getSetupProcess
			.call(this, data)
			.next(function () {
				if (data && data.nodeId) {
					SelectedNode = data.nodeId;
					var mode = 'edit';
					this.initializeResultsPanel(mode);
					this.actions.setMode(mode);
				} else {
					this.actions.setMode('select');
				}
			}, this);
	};

	MyDialog.prototype.initializeResultsPanel = function (
		mode,
		selectedTab,
		data,
		titleFullText
	) {
		// 	ModelProperties = {};
		// 	var items = [];
		// 	for (var i in Properties) {
		// 		var toggleInput = new OO.ui.ToggleSwitchWidget({
		// 			value: true,
		// 		});
		// 		ModelProperties[i] = toggleInput;
		// 		var field = new OO.ui.FieldLayout(toggleInput, {
		// 			label: i,
		// 			help: '',
		// 			helpInline: true,
		// 			align: 'top',
		// 		});
		// 		items.push(field);
		// 	}
		// 	this.fieldset.addItems(items);

		this.panelB.$element.empty();

		if (mode === 'no-results') {
			// mw.msg
			var msg = selectedTab === 'by-article' ? 'No properties' : 'No articles';

			$el = $('<span>' + msg + '</span>');
		} else if (mode === 'existing-node') {
			// mw.msg
			$el = $('<span>Existing node</span>');
		} else {
			$el = $('<ul>');
			switch (selectedTab) {
				case 'by-article':
					// mw.msg
					this.panelB.$element.append('<h3>Has properties:</h3>');
					var properties = data[titleFullText];
					for (var i in properties) {
						var url = mw.config.get('wgArticlePath').replace('$1', i);

						$el.append(
							$(
								'<li><a target="_blank" href="' +
									url +
									'">' +
									(properties[i].preferredLabel !== ''
										? properties[i].preferredLabel
										: properties[i].canonicalLabel) +
									'</a> (' +
									properties[i].typeLabel +
									')' +
									'</li>'
							)
						);
					}
					break;

				case 'by-properties':
					// mw.msg
					this.panelB.$element.append('<h3>Importing nodes:</h3>');
					for (var i in data) {
						if (!(i in Data)) {
							var url = mw.config.get('wgArticlePath').replace('$1', i);

							$el.append(
								$(
									'<li><a target="_blank" href="' +
										url +
										'">' +
										i +
										'</a> </li>'
								)
							);
						}
					}
			}
		}
		this.panelB.$element.append($el);
		var panel = this.stackLayout.getItems()[1];
		this.stackLayout.setItem(panel);
	};

	// Specify processes to handle the actions.
	MyDialog.prototype.getActionProcess = function (action) {
		var selfDialog = this;
		switch (action) {
			case 'delete':
				// mw.msg
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
							var selectedTab = selfDialog.indexLayout.getCurrentTabPanelName();
							var titleValue = null;
							var properties = null;

							switch (selectedTab) {
								case 'by-article':
									titleValue = selfDialog.titleInputWidget.getValue();
									var titleFullText = selfDialog.titleInputWidget
										.getMWTitle()
										.getPrefixedText();

									if (titleFullText in Data) {
										selfDialog.actions.setMode('existing-node');
										selfDialog.initializeResultsPanel('existing-node');
										resolve();
										return;
									}

									if (titleValue === '') {
										reject();
									}

									break;

								case 'by-properties':
									properties = selfDialog.propertiesInputWidget.getValue();

									if (!properties.length) {
										reject();
									}
							}

							loadNodes({ title: titleValue, properties }).then(
								function (data) {
									// Properties = data[titleFullText];
									TmpData = data;
									if (selectedTab === 'by-article') {
										var properties = data[titleFullText];
										var mode = Object.keys(properties).length
											? 'show-results'
											: 'no-results';
									} else {
										var mode = Object.keys(data).length
											? 'show-results'
											: 'no-results';
									}
									selfDialog.initializeResultsPanel(
										mode,
										selectedTab,
										data,
										selectedTab === 'by-article' ? titleFullText : null
									);
									selfDialog.actions.setMode(mode);
									resolve();
								}
							);
						}).catch((err) => {
							console.log('err', err);
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
			return new OO.ui.Process(function () {
				window.open(this.urlInput.getValue());
			}, this);
		}

		return MyDialog.super.prototype.getActionProcess.call(this, action);
	};

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

				case 'show-config':
					Config.graphOptions.configure.enabled =
						!Config.graphOptions.configure.enabled;
					$(ContainerOptions).toggle(Config.graphOptions.configure.enabled);
					break;

				case 'reload':
					// mw.msg
					if (confirm('Are you sure you want to reinitialize the Network ?')) {
						Data = {};
						Nodes = new vis.DataSet([]);
						Edges = new vis.DataSet([]);

						Network.setData({ nodes: Nodes, edges: Edges });

						createNodes(InitialData);

						// Network.destroy();
						// initializeNetwork(InitialData);
					}
			}

			this.setActive(false);
		};

		var toolGroup = [
			{
				name: 'add-node',
				icon: 'add',
				// mw.msg
				title: 'add node',
				onSelect: onSelect,
			},
			{
				name: 'show-config',
				icon: 'settings',
				// mw.msg
				title: 'toggle config',
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
				icon: 'eye',
				// mw.msg
				title: 'export graph',
				onSelect: onSelect,
			},
		];

		// if (Config.context === 'parserfunction') {
		if (true) {
			toolGroup.splice(2, 0, {
				name: 'reload',
				icon: 'reload',
				// mw.msg
				title: 'reset',
				onSelect: onSelect,
			});
		}

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

	console.log('semanticGraphs', semanticGraphs);

	async function getModule(str) {
		var module = await import(`data:text/javascript;base64,${btoa(str)}`);
		if ('default' in module) {
			return module.default;
		}
		return null;
	}

	$('.KnowledgeGraph').each(async function (index) {
		var graphData = semanticGraphs[index];

		var graph = new KnowledgeGraph();

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

		graphData.graphOptions = $.extend(
			new KnowledgeGraph().getDefaultOptions(),
			graphData.graphOptions
		);

		var config = $.extend(
			true,
			{
				data: {},
				// graphOptions: new KnowledgeGraph().getDefaultOptions(),
				propertyOptions: {},
				'only-properties': [],
				'nodes-by-properties': {},
				depth: '',
				width: '',
				height: '',
				'show-toolbar': false,
				'show-property-type': false,
				context: 'parserfunction',
			},
			graphData
		);

		if (config.width !== '') {
			config.graphOptions.width = config.width;
		}
		if (config.height !== '') {
			config.graphOptions.height = config.height;
		}

		var container = this;
		var containerToolbar = null;
		var containerOptions = null;

		if (!config.graphOptions.configure.container) {
			if (config['show-toolbar']) {
				var $container = $(this).clone();

				$table = $(
					`
<div class="KnowledgeGraphTable" style="display:table" style="height:` +
						config.height +
						`">
	<div style="display:table-row" class="KnowledgeGraph-toolbar">
	
	</div>
	<div style="display:table-row">
		<div class="KnowledgeGraph-network" style="display:table-cell;width:50%;vertical-align:top"></div>
		<div class="KnowledgeGraph-options" style="display:table-cell;width:50%"><div style="width:auto;height:` +
						config.height +
						`;overflow:scroll"></div></div>
	</div>
</div>`
				);

				$table.find('.KnowledgeGraph-network').append($container);
				config.graphOptions.configure.container = $table
					.find('.KnowledgeGraph-options > div')
					.get(0);

				$(this).replaceWith($table);

				container = $container.get(0);
				containerToolbar = $table.find('.KnowledgeGraph-toolbar').get(0);
				containerOptions = $table.find('.KnowledgeGraph-options').get(0);

				config.graphOptions.configure.enabled = true;
			} else {
				config.graphOptions.configure.enabled = false;
			}
		} else {
			containerOptions = config.graphOptions.configure.container;
		}

		graph.initialize(container, containerToolbar, containerOptions, config);
	});
});

