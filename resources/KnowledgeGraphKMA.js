/**
 * KnowledgeGraphKMA
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

KnowledgeGraphKMA = function () {
	var ModelProperties = {};
	var Properties = {};
	var Canvas = {};
	var Nodes = new vis.DataSet([]);
	var Edges = new vis.DataSet([]);
	var SelectedLabel = null;

	function initialize(container, config) {
		console.log('config', config);

		var toolbar = createToolbar();

		toolbar.$element.insertBefore(container);

		var options = getDefaultOptions();

		//create the network
		this.network = new vis.Network(
			container,
			{ nodes: Nodes, edges: Edges },
			options
		);

		var self = this;
		this.network.on('click', function (params) {
			console.log('params', params);
			var nodeId = params.nodes[0];
			console.log('nodeId', nodeId);
			if (nodeId !== undefined) {
				var clickedNode = Nodes.get(nodeId);

				// Show popup with node information
				//self.network.showPopup(nodeId, '<div>' + clickedNode.label + '</div>');

				openDialog(nodeId);
				return;
			}

			openDialog(null);

			Canvas = params.pointer.canvas;
		});
	}

	function getDefaultOptions() {
		var options = {
			autoResize: true,
			height: '100%',
			width: '100%',
			locale: 'en',
			//  locales: locales,
			clickToUse: false,
			configure: {},
			edges: {},
			nodes: {},
			groups: {},
			layout: {},
			interaction: {},
			manipulation: {},
			physics: {
				stabilization: {
					enabled: true,
				},
				barnesHut: {
					gravitationalConstant: -40000,
					centralGravity: 0,
					springLength: 0,
					springConstant: 0.5,
					damping: 1,
					avoidOverlap: 0,
				},
				maxVelocity: 5,
			},
		};

		return options;
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

		windowManager.openWindow(myDialog, { nodeId });
	}

	function printNodes(pointer) {
		console.log('printNodes', ModelProperties);

		// var pageId = Properties.pageid;
		// console.log('pageId', pageId);
		var nodeId = Nodes.add({
			id: SelectedLabel,
			label: SelectedLabel,
			color: '#6dbfa9',
			hidden: false,
			x: Canvas.x,
			y: Canvas.y,
			physics: false,
			title: 'sdds <ul> <li>a</ul>',
		});
		var properties = [];
		for (var propLabel in Properties[SelectedLabel]) {
			if (!ModelProperties[propLabel].getValue()) {
				continue;
			}

			var propValue = Properties[SelectedLabel][propLabel];
			// property label
			var propValue = propValue.join(', ');
			properties.push(propLabel);

			var color = new isg.util.Color().randomHSL();
			var valueId = isg.util.uuidv4();

			// connection/predicate
			Edges.add({
				from: SelectedLabel,
				to: valueId,
				label: propLabel,
				color: color,
				group: propLabel,
			});

			// value / object
			Nodes.add({
				id: valueId,
				label: propValue,
				color: color,
			});
		}
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

		for (var i in Properties[SelectedLabel]) {
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
					SelectedLabel = data.nodeId;
					console.log('SelectedLabel', SelectedLabel);
					console.log('Properties', Properties);

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
		console.log('action', action);
		console.log('titleInputWidget', this.titleInputWidget.getValue());

		var selfDialog = this;
		switch (action) {
			case 'done':
				printNodes();
				return new OO.ui.Process(function () {
					selfDialog.close({ action: action });
				});
				break;
			case 'continue':
				return MyDialog.super.prototype.getActionProcess
					.call(this, action)
					.next(function () {
						var payload = {
							title: selfDialog.titleInputWidget.getValue(),
							action: 'knowledgegraph-semantic-properties',
						};
						return new Promise((resolve, reject) => {
							mw.loader.using('mediawiki.api', function () {
								new mw.Api()
									.postWithToken('csrf', payload)
									.done(function (thisRes) {
										console.log('thisRes', thisRes);
										if ('data' in thisRes[payload.action]) {
											SelectedLabel = payload.title;
											Properties[SelectedLabel] =
												thisRes[payload.action].data.properties;

											selfDialog.initializePropertyPanel();
											selfDialog.actions.setMode('properties');
											resolve();
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
			{
				name: 'nodes-by-property',
				icon: 'add',
				title: 'add nodes by property',
				onSelect: onSelect,
			},
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

	function getProperties(pageids) {
		console.log('pageids', pageids);

		return new Promise((resolve, reject) => {
			var payload = {
				action: 'KnowledgeGraph-semantic-properties',
				pageids: pageids.join(','),
			};

			mw.loader.using('mediawiki.api', function () {
				new mw.Api()
					.postWithToken('csrf', payload)
					.done(function (res) {
						console.log('res', res);
					})
					.fail(function (res) {
						console.log('error' + res);
					});
			});
		}).catch((err) => {
			console.log(err);
		});
	}

	return {
		initialize,
	};
};

$(document).ready(function () {
	var semanticGraphs = JSON.parse(mw.config.get('knowledgegraphs'));

	$('.KnowledgeGraph').each(function (index) {
		var graphData = semanticGraphs[index];
		var defaultOptions = {
			nodes: {},
			nodeoptions: {},
			propertyoptions: {},
		};

		var config = $.extend(defaultOptions, graphData);

		var graph = new KnowledgeGraphKMA();
		graph.initialize(this, config);
	});
});
