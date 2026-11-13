import type { ModeId, WorkbenchModePlugin } from "@/core/contracts/mode-plugin";

/**
 * PluginRegistry: Central seam for registering and discovering WorkbenchModePlugin implementations.
 * Adding a 4th mode requires only registering a new plugin here with zero changes to engine or UI.
 */
export class PluginRegistry {
  private readonly plugins = new Map<ModeId, WorkbenchModePlugin>();

  register(plugin: WorkbenchModePlugin): this {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Duplicate plugin id registered: "${plugin.id}"`);
    }
    this.plugins.set(plugin.id, plugin);
    return this;
  }

  get(id: ModeId): WorkbenchModePlugin {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      throw new Error(`Unknown mode plugin: "${id}". Registered: ${Array.from(this.plugins.keys()).join(", ")}`);
    }
    return plugin;
  }

  has(id: ModeId): boolean {
    return this.plugins.has(id);
  }

  list(): WorkbenchModePlugin[] {
    return Array.from(this.plugins.values());
  }
}
