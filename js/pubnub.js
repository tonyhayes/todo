(function() {
    // model for a single task
    var TaskModel = Backbone.Model.extend({});

    // a set of TaskModel's 
    var TasksCollection = Backbone.Collection.extend({});

    // the collection singleton for the app
    var task_collection = new TasksCollection();


    // PubNub channel were sending and listening for tasks
    var CHANNEL = 'task-list';

    // init the pubnub object
    var pubnub = PUBNUB.init({
        publish_key: 'demo',
        subscribe_key: 'demo'
    });

    // given a task dictionary send it over pubnub
    var send_task = function(task) {
        pubnub.publish({
            channel: CHANNEL,
            message: {
                'task': task.toJSON()
            }

        });
    };

    // when a task is added to the collection singleton send it
    task_collection.on('add', function(task) {
        send_task(task);
    });
    // listen for task messages
    pubnub.subscribe({
        channel: CHANNEL,
        message: function(m) {
            // if someone joins dump our task list to them
            if (m.task && m.task.remove) {
                task_collection.remove(m.task);
                var remove_task = task_collection.where({
                    'name': m.task.name,
                    'created': m.task.created
                });
                if (remove_task.length > 0) {
                    for (var i = 0; i < remove_task.length; i++) {
                        remove_task[i].attributes.remove = false;
                        task_collection.remove(remove_task[i]);
                    }

                }
                return;

            }
            if (m.join === true) {
                task_collection.forEach(function(task) {
                    send_task(task);
                });
                return;
            }
            // else it's a task so if we have the task (by name) drop it on the floor
            var existing_task = task_collection.where({
                'name': m.task.name
            });
            if (existing_task.length > 0) {
                for (var i = 0; i < existing_task.length; i++) {
                    if (existing_task[i].attributes.remove == true) {
                        existing_task[i].attributes.remove = false
                        task_collection.remove(existing_task[i]);

                    }
                }
                return;

            }

            // we don't have the task so add it to my set
            task_collection.add(new TaskModel(m.task));
        },
        connect: function() {
            pubnub.publish({
                channel: CHANNEL,
                message: {
                    'join': true
                }

            });

        }
    });

    // base class for our views, does some general view management and initialization 
    var BaseView = Backbone.View.extend({
        initialize: function(el, options) {
            Backbone.View.prototype.initialize.apply(this, [options]);
            this.options = $.extend(true, options, this.options);
            this.setElement(el);

        },
        serialize_form: function(form) {
            var inputs = $('input', $(form));
            var names = inputs.attr('name');
            var assigned = inputs.attr('assign');
            var values = inputs.val();
            // Get the value from name
            var values = $("input:text[name=name]").val();
            var assigned = $("input:text[name=assign]").val();


            // names = $.type(names) === 'string' ? [names] : names;
            // values = $.type(values) === 'string' ? [values] : values;

            var data = {
                name: values,
                assign: assigned
            };
            // _.each(names, function(name, i) {
            //     data[names[i]] = values[i];

            // });
            return data;

        },
        render: function() {
            var tpl = this.template();
            this.$el.html(tpl);
        }

    });
    /**
        TasksView, 
        takes the <script id="tasks-template"> template and applies it to the #tasks div

    **/
    var TasksView = BaseView.extend({
        task_tpl: null,
        template: function() {
            return _.template($('#tasks-template').html(), {
                'tasks': this.options.tasks,
                'TaskTpl': this.task_tpl
            });
        },
        initialize: function(el, options) {
            BaseView.prototype.initialize.apply(this, [el, options]);
            // get the individual task template
            this.task_tpl = $('#task-template').html();
            // bind the add and remove collection events to the given TaskCollection singleton
            this.options.tasks.on('add', this.render, this);
            this.options.tasks.on('remove', this.render, this);
        }

    });
    /**
        TasksWrapperView,
        Wraps the form and TasksView, captures the click and submit events and performs operations on the TaskCollection singleton
        takes the <script id="tasks-view-template"> template and binds it to the #tasks-container
    **/
    var TasksWrapperView = BaseView.extend({
        initialize: function(el, options) {
            BaseView.prototype.initialize.apply(this, [el, options]);
        },
        template: function() {
            return _.template($('#tasks-view-template').html(), {
                'tasks': this.options.tasks
            });
        },
        render: function() {
            BaseView.prototype.render.call(this);
            // construct the TaskView to the #tasks
            new TasksView($('#tasks', this.$el), {
                'tasks': this.options.tasks
            }).render();
        },
        events: {
            'submit #new-task': 'newTask',
            'click .task .remove': 'removeTask'

        },
        newTask: function(e) {
            e.preventDefault();
            var task_data = this.serialize_form(e.currentTarget)
            task_data.created = new Date().toString();
            task_data.modified = new Date().toString();

            if (!task_data.assign) {
                task_data.assign = 'Unassigned';
            }

            // do not add empty tasks
            if (!task_data.name) {
                return;
            }

            // only add if new task
            var existing_task = task_collection.where({
                'name': task_data.name
            });
            if (existing_task.length > 0) {
                return;

            }

            this.options.tasks.add(new TaskModel(task_data));

            //rest form
            $(':input', '#new-task')
                .not(':button, :submit, :reset, :hidden')
                .val('')
                .removeAttr('checked')
                .removeAttr('selected');

        },
        removeTask: function(e) {
            e.preventDefault();
            var index = $(e.currentTarget).data('id');
            var task_data = this.options.tasks.at(index)
            task_data.attributes.modified = new Date().toString()
            task_data.attributes.remove = true;
            send_task(task_data);
            this.options.tasks.remove(task_data);



        }
    });

    // bind the application
    $(document).ready(function() {
        var task_view = new TasksWrapperView($('#tasks-container'), {
            'tasks': task_collection
        }).render();
    });
})();