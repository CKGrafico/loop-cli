import { Command, CommandContext } from '../../app/types.js';
import {
  COMMAND_TIER_ACTION,
  COMMAND_TIER_CONFIRM,
  COMMAND_TIER_GLOBAL,
  COMMAND_CATEGORY_GLOBAL,
  COMMAND_CATEGORY_FILTERS,
  COMMAND_CATEGORY_LOOP,
  COMMAND_CATEGORY_TASK,
  COMMAND_CATEGORY_PROJECT,
} from '../../shared/config/constants.js';
import { t } from '../../shared/i18n/index.js';



function globalCommands(): Command[] {
  return [
    { label: t('cmd.help'), value: 'help', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL, shortcut: 'ctrl+p' },
    { label: t('cmd.debug'), value: 'debug', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL, shortcut: 'ctrl+b' },
    { label: t('cmd.toggleApi'), value: 'toggle-api', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL },
    { label: t('cmd.api'), value: 'api', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL },
    { label: t('cmd.toggleMcp'), value: 'toggle-mcp', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL },
    { label: t('cmd.mcp'), value: 'mcp', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL },
    { label: t('cmd.toggleTelemetry'), value: 'toggle-telemetry', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL },
    { label: t('cmd.telemetryDiagnostics'), value: 'telemetry-diagnostics', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL },
    { label: t('cmd.telemetry'), value: 'telemetry', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL },
    { label: 'OpenCode Server', value: 'opencode-server', hint: 'http://localhost:4096', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL },
    { label: t('cmd.export'), value: 'export', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL, shortcut: 'ctrl+x' },
    { label: t('cmd.import'), value: 'import', hint: '', tier: COMMAND_TIER_GLOBAL, category: COMMAND_CATEGORY_GLOBAL, shortcut: 'ctrl+i' },
  ];
}

function loopFilterCommands(): Command[] {
  return [
    { label: t('cmd.search'), value: 'search', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_FILTERS, shortcut: 'ctrl+f+s' },
    { label: t('cmd.filterStatus'), value: 'filter-status', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_FILTERS, shortcut: 'ctrl+f+t' },
    { label: t('cmd.sort'), value: 'sort', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_FILTERS, shortcut: 'ctrl+f+o' },
    { label: t('cmd.project'), value: 'filter-project', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_FILTERS, shortcut: 'ctrl+f+p' },
  ];
}

function taskFilterCommands(): Command[] {
  return [
    { label: t('cmd.searchTasks'), value: 'search', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_FILTERS, shortcut: 'ctrl+f+s' },
  ];
}

function projectFilterCommands(): Command[] {
  return [
    { label: t('cmd.searchProjects'), value: 'search', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_FILTERS, shortcut: 'ctrl+f+s' },
  ];
}



/**
 * Re-rank autocomplete options: exact match → prefix match → fuzzy (existing order).
 * Stable within each group. Exported for testing.
 */
export function rankCommands(
  input: string,
  options: { label: string; value: string }[],
): { label: string; value: string }[] {
  if (input.length === 0) return options;

  const q = input.toLowerCase();

  const exact: { label: string; value: string }[] = [];
  const prefix: { label: string; value: string }[] = [];
  const fuzzy: { label: string; value: string }[] = [];

  for (const opt of options) {
    const l = opt.label.toLowerCase();
    const v = opt.value.toLowerCase();
    if (l === q || v === q) {
      exact.push(opt);
    } else if (l.startsWith(q) || v.startsWith(q)) {
      prefix.push(opt);
    } else {
      fuzzy.push(opt);
    }
  }

  return [...exact, ...prefix, ...fuzzy];
}



export function buildCommands(context: CommandContext): Command[] {
  const commands: Command[] = [...globalCommands()];

  if (context.activeTab === 'loops') {
    commands.push(...loopFilterCommands());
    commands.push({
      label: t('cmd.newLoop'), value: 'new-loop', hint: '',
      tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+n',
    });

    if (context.selectedLoop !== null) {
      const loop = context.selectedLoop;
      const desc = loop.description || loop.id;
      commands.push(
        { label: t('cmd.edit'), value: 'edit', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+e' },
        { label: t('cmd.pause'), value: 'pause', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+p' },
        { label: t('cmd.play'), value: 'play', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+r' },
        { label: t('cmd.stop'), value: 'stop', hint: t('confirm.stopLoop', { name: desc }), tier: COMMAND_TIER_CONFIRM, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+s' },
        { label: t('cmd.trigger'), value: 'trigger', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+t' },
        { label: t('cmd.clone'), value: 'clone', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+c' },
        { label: t('cmd.delete'), value: 'delete', hint: t('confirm.deleteLoop', { name: desc }), tier: COMMAND_TIER_CONFIRM, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+d' },
        { label: t('cmd.logs'), value: 'logs', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+o' },
      );

      if (loop.taskId) {
        commands.push({
          label: t('cmd.diagram'), value: 'diagram', hint: '',
          tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP,
        });
      }
    }
  }

  if (context.activeTab === 'tasks') {
    commands.push(...taskFilterCommands());
    commands.push({
      label: t('cmd.newTask'), value: 'new-task', hint: '',
      tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_TASK, shortcut: 'ctrl+a+n',
    });

    if (context.selectedTask !== null) {
      const task = context.selectedTask;
      commands.push(
        { label: t('cmd.editTask'), value: 'edit', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_TASK, shortcut: 'ctrl+a+e' },
        { label: t('cmd.deleteTask'), value: 'delete', hint: t('confirm.deleteTask', { id: task.id }), tier: COMMAND_TIER_CONFIRM, category: COMMAND_CATEGORY_TASK, shortcut: 'ctrl+a+d' },
      );
      if (task.isRecipeTask) {
        // Remove edit and delete for recipe tasks — they are immutable
        commands.pop();
        commands.pop();
      }
    }
  }

  if (context.activeTab === 'projects') {
    commands.push(...projectFilterCommands());
    commands.push({
      label: t('cmd.newProject'), value: 'new-project', hint: '',
      tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_PROJECT, shortcut: 'ctrl+a+n',
    });

    if (context.selectedProject !== null) {
      const project = context.selectedProject;
      commands.push(
        { label: t('cmd.editProject'), value: 'edit', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_PROJECT, shortcut: 'ctrl+a+e' },
        { label: t('cmd.deleteProject'), value: 'delete', hint: t('confirm.deleteProject', { name: project.name }), tier: COMMAND_TIER_CONFIRM, category: COMMAND_CATEGORY_PROJECT, shortcut: 'ctrl+a+d' },
      );
    }
  }

  return commands;
}



export function buildTabCommands(context: CommandContext): Command[] {
  const commands: Command[] = [...globalCommands()];

  if (context.activeTab === 'loops') {
    commands.push(...loopFilterCommands());
    commands.push(
      { label: t('cmd.newLoop'), value: 'new-loop', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+n' },
      { label: t('cmd.edit'), value: 'edit', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+e' },
      { label: t('cmd.pause'), value: 'pause', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+p' },
      { label: t('cmd.play'), value: 'play', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+r' },
      { label: t('cmd.stop'), value: 'stop', hint: '', tier: COMMAND_TIER_CONFIRM, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+s' },
      { label: t('cmd.trigger'), value: 'trigger', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+t' },
      { label: t('cmd.clone'), value: 'clone', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+c' },
      { label: t('cmd.delete'), value: 'delete', hint: '', tier: COMMAND_TIER_CONFIRM, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+d' },
      { label: t('cmd.logs'), value: 'logs', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP, shortcut: 'ctrl+a+o' },
    );

    if (context.selectedLoop?.taskId) {
      commands.push({
        label: t('cmd.diagram'), value: 'diagram', hint: '',
        tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_LOOP,
      });
    }
  }

  if (context.activeTab === 'tasks') {
    commands.push(...taskFilterCommands());
    commands.push(
      { label: t('cmd.newTask'), value: 'new-task', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_TASK, shortcut: 'ctrl+a+n' },
      { label: t('cmd.editTask'), value: 'edit', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_TASK, shortcut: 'ctrl+a+e' },
      { label: t('cmd.deleteTask'), value: 'delete', hint: '', tier: COMMAND_TIER_CONFIRM, category: COMMAND_CATEGORY_TASK, shortcut: 'ctrl+a+d' },
    );
  }

  if (context.activeTab === 'projects') {
    commands.push(...projectFilterCommands());
    commands.push(
      { label: t('cmd.newProject'), value: 'new-project', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_PROJECT, shortcut: 'ctrl+a+n' },
      { label: t('cmd.editProject'), value: 'edit', hint: '', tier: COMMAND_TIER_ACTION, category: COMMAND_CATEGORY_PROJECT, shortcut: 'ctrl+a+e' },
      { label: t('cmd.deleteProject'), value: 'delete', hint: '', tier: COMMAND_TIER_CONFIRM, category: COMMAND_CATEGORY_PROJECT, shortcut: 'ctrl+a+d' },
    );
  }

  return commands;
}
