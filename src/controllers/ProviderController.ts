import { Request, Response } from 'express';
import { ProviderManager } from '../providers/ProviderManager';

export class ProviderController {
	constructor(private providerMan: ProviderManager) {}
	async getProviders(req: Request, res: Response): Promise<void> {
		try {
			const actionProviders = this.providerMan
				.getProviders()
				.map((provider) => provider.providerId);

			res.json(actionProviders);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	async getCategories(req: Request, res: Response): Promise<void> {
		try {
			const provider = this.providerMan.getProvider(req.params.providerId);
			if (provider === undefined) {
				res.status(404).json({ error: 'Provider not found' });
				return;
			}

			res.json(provider.getCategories());
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	async getActions(req: Request, res: Response): Promise<void> {
		try {
			const provider = this.providerMan.getProvider(req.params.providerId);
			if (provider === undefined) {
				res.status(404).json({ error: 'Provider not found' });
				return;
			}

			const map = provider.getActionMap(req.params.category);
			res.json(map.getActions());
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	async loadActions(req: Request, res: Response): Promise<void> {
		try {
			const provider = this.providerMan.getProvider(req.params.providerId);
			if (provider === undefined) {
				res.status(404).json({ error: 'Provider not found' });
				return;
			}

			await provider.loadActions();
			res.json({
				message: 'Actions loaded',
				provider: provider.providerId,
				count: provider.actionCount(),
			});
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	async loadAllActions(req: Request, res: Response): Promise<void> {
		try {
			let actions = 0;
			const providers: string[] = [];

			for (const provider of this.providerMan.getProviders()) {
				await provider.loadActions();
				providers.push(provider.providerId);
				actions += provider.actionCount();
			}

			res.json({
				message: 'Actions loaded',
				providers,
				count: actions,
			});
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}
}
