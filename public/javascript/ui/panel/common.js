var zombie_execute_button_text = 'Execute'
var zombie_reexecute_button_text = 'Re-execute'
var re_execute_command_title = 'Re-execute command'

/**
 * Generates fields for the form used to send command modules.
 *
 * @param: {Object} the form to generate the field in.
 * @param: {String/Object} the field name or it's definition as an object.
 * @param: {String} the value that field should have.
 * @param: {Boolean} set to true if you want the field to be disabled.
 * @param: {Object} the targeted Zombie.
 * @param: {Object} the status bar.
 */
function genExploitFormControl(form, input, value, disabled, zombie, sb) {
	var input_name;
	var input_type = 'TextField';
	
	if(typeof input == 'string') {
		input_name = input;
		var field = new Ext.form.TextField({
				id: 'form-zombie-'+zombie.session+'-field-'+input_name,
				fieldLabel: input_name,
				name: 'txt_'+input_name,
				width: 175,
				allowBlank:false
			});
		
		if(value) field.setValue(value);
		
		if(disabled) field.setDisabled(true);
		
		form.add(field);
	}
	else if(typeof input == 'object') {
		var field = null, input_def;
		
		if(typeof input[0] == 'object') input = input[0];
		
		if (!input['name']) return;
		if (!input['ui_label']) input['ui_label'] = input['name'];
		if (!input['type']) input['type'] = 'textfield';
		if (!input['value']) input['value'] = '';
		
		input_id = 'form-zombie-'+zombie.session+'-field-'+input['name'];
		input_def = {id: input_id, name: 'txt_'+input['name'], fieldLabel: input['ui_label'], allowBlank:false, value: input['value']};
		
		switch(input['type'].toLowerCase()) {
			case 'textarea':
				field = new Ext.form.TextArea(input_def);
				break;
			case 'hidden':
				field = new Ext.form.Hidden(input_def);
				break;
			default:
				field = new Ext.form.TextField(input_def);
				break;
		}
		
		for(definition in input) {
			if(input[definition] && (typeof input[definition] == 'string') && (definition != 'type')
				&& (definition != 'name')) {
				field[definition] = input[definition];
			}
		}
		
		if(value) field.setValue(value);
		
		if(disabled) field.setDisabled(true);
		
		form.add(field);
	} else {
		return;
	}
};

/**
 * Generate a panel for an command module that already has been executed.
 * 
 * @param: {Object} the Panel in the UI to generate the form into.
 * @param: {Integer} the command id to generate the panel for.
 * @param: {Object} the targeted Zombie.
 * @param: {Object} the status bar.
 */
function genExisingExploitPanel(panel, command_id, zombie, sb) {
	if(typeof panel != 'object') {
		Ext.beef.msg('Bad!', 'Incorrect panel chosen.');
		return;
	}
	
	sb.showBusy(); // status bar update
	panel.removeAll();
	
	Ext.Ajax.request({
		url:'/ui/modules/select/command.json?command_id='+command_id,
		loadMask: true,
		success: function(resp) {
			var xhr = Ext.decode(resp.responseText);
			
			if(!xhr || !xhr.definition) {
				Ext.beef.msg('Error!', 'We could not retrieve the definition of that command module...');
				return;
			}
			
			if(xhr.command_module_name == 'some specific command module') {
				//HERE we will develop specific panels for the command modules that require it.
				return;
			}
			
			var form = new Ext.form.FormPanel({
				url: '/ui/modules/commandmodule/reexecute',
				id: 'form-command-module-zombie-'+zombie.session,
				border: false,
				labelWidth: 75,
				defaultType: 'textfield',
				title: re_execute_command_title,
				bodyStyle: 'padding: 5px;',
				
				items: [new Ext.form.Hidden({name: 'command_id', value: command_id})],
				
				buttons:[{
					text: zombie_reexecute_button_text,	
					handler: function()	{
						var form = Ext.getCmp('form-command-module-zombie-'+zombie.session);
						if(!form || !form.getForm().isValid()) return;
						
						sb.update_sending('Sending commands to ' + zombie.ip + '...'); // status bar update
						
						var command_module_form = form.getForm(); // form to be submitted when execute button is pressed on an command module tab
						command_module_form.submit({
							params: {  // insert the nonce with the form
									nonce: Ext.get ("nonce").dom.value
							},
							success: function() {
								sb.update_sent("Commands sent to zombie " + zombie.ip); // status bar update
							},
							failure: function() {
								sb.update_fail("Error!"); // status bar update
							}
						});
					}
				}]
			});
			
			Ext.each(xhr.definition.Data, function(input) {
				var value;
				
				if(typeof input == 'string') {
					value = xhr.data[input];
				}
				
				if(typeof input == 'object' && typeof input[0] == 'object') {
					value = xhr.data[input[0]['name']]
				}
				
				genExploitFormControl(form, input, value, false, zombie, sb);
			});
			
			var grid_store = new Ext.data.JsonStore({
				url: '/ui/modules/select/command_results.json?command_id='+command_id,
				storeId: 'command-results-store-zombie-'+zombie.session,
		        root: 'results',
				remoteSort: false,
				autoDestroy: true,
		        fields: [
					{name: 'date', type: 'date', dateFormat: 'timestamp'},
					{name: 'data'}
				]
			});
			
			Ext.TaskMgr.start({
			    run: function(task) {
					var grid = Ext.getCmp('command-results-grid-zombie-'+zombie.session);
					//here we have to check for the existance of the grid before reloading
					//because we do not want to reload the store if the tab has been closed.
					if(grid_store && grid) {
						grid_store.reload();
					}
				},
			    interval: 4000
			});
			
			var grid = new Ext.grid.GridPanel({
				id: 'command-results-grid-zombie-'+zombie.session,
				store: grid_store,
				border: false,
				hideHeaders: true,
				title: 'Command results',
				
				viewConfig: {
					forceFit:true
				},
				
		        columns:[new Ext.grid.RowNumberer({width: 20}), {
			            dataIndex: 'date',
			            sortable: false,
						renderer: function(value, p, record) {
							html = String.format("<div style='color:#385F95;text-align:right;'>{0}</div>", value);
							html += '<p>';
							
							for(index in record.data.data) {
								result = record.data.data[index];
								index = index.toString().replace('_', ' ');
								
								html += String.format('<b>{0}</b>: {1}<br>', index, result);
							}
							
							html += '</p>';
							return html;
						}
		        	}]
		    });

			grid.store.load();

			var accordion = new Ext.Panel({
				id: 'command-results-accordion-zombie-'+zombie.session,
				layout:'accordion',
				border: false,
				items: [grid, form]
			});
				
			panel.add(accordion);
			panel.doLayout();
			
			sb.update_ready(); // status bar update
		}
	});
};

/**
 * Generate a panel for an command module.
 * 
 * @param: {Object} the Panel in the UI to generate the form into.
 * @param: {String} the path to the command module file in the framework.
 * @param: {String} the name of the command module.
 * @param: {Object} the targeted Zombie.
 * @param: {Object} the status bar.
 */
function genNewExploitPanel(panel, command_module_id, command_module_name, zombie, sb) {
	if(typeof panel != 'object') {
		Ext.beef.msg('Bad!', 'Incorrect panel chosen.');
		return;
	}
	
	var xgrid = Ext.getCmp('command-module-grid-zombie-'+zombie.session);
	var sb = Ext.getCmp('commands-bbar-zombie-'+zombie.session);
	
	if(command_module_name == 'some special command module') {
		//HERE we will develop specific panels for the command modules that require it.
	} else {
		Ext.Ajax.request({
			loadMask: true,
		  	url: '/ui/modules/select/commandmodule.json?command_module_id='+command_module_id,
			success: function(resp) {
				var module = Ext.decode(resp.responseText);
				
				if(!module) {
					Ext.beef.msg('Error!', 'We could not retrieve the definition of that command_module...');
					return;
				}
				
				module = module.command_modules[1];
				panel.removeAll();
				
				var form = new Ext.form.FormPanel({
					url: '/ui/modules/commandmodule/new',
					
					id: 'form-command-module-zombie-'+zombie.session,
					border: false,
					labelWidth: 75,
					defaultType: 'textfield',
					title: module.Name,
					bodyStyle: 'padding: 5px;',
					
					items: [
						new Ext.form.Hidden({name: 'zombie_session', value: zombie.session}),
						new Ext.form.Hidden({name: 'command_module_id', value: command_module_id}),
						new Ext.form.DisplayField({
							name: 'command_module_description',
							fieldLabel: 'Description',
							fieldClass: 'command-module-panel-description',
							value: module.Description
							})
					],
					
					buttons:[{
						text: zombie_execute_button_text,	
						handler: function()	{
							var form = Ext.getCmp('form-command-module-zombie-'+zombie.session), command_module_params = new Array();
							if(!form || !form.getForm().isValid()) return;
							
							sb.update_sending('Sending commands to ' + zombie.ip + '...'); // status bar update
							
							var command_module_form = form.getForm();  // form to be submitted when execute button is pressed on an command module tab
							command_module_form.submit({
								params: {  // insert the nonce with the form
										nonce: Ext.get ("nonce").dom.value
								},
								success: function() {
									xgrid.i = 0;
									xgrid.store.reload({  //reload the command module grid
										params: {  // insert the nonce with the request to reload the grid
											nonce: Ext.get ("nonce").dom.value
								    	}		
									});
									sb.update_sent("Commands sent to zombie " + zombie.ip); // status bar update
								},
								failure: function() {
									sb.update_fail("Error!"); // status bar update
								}
							});
						}
					}]
				});
				
				Ext.each(module.Data, function(input){genExploitFormControl(form, input, null, false, zombie, sb)});
				
				panel.add(form);
				panel.doLayout();
			}
		});
	}
};