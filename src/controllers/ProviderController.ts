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

	async getProvider(req: Request, res: Response): Promise<void> {
		try {
			const provider = this.providerMan.getProvider(req.params.id);
			if (provider === undefined) {
				res.status(404).json({ error: 'Provider not found' });
				return;
			}
			res.json(provider);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}
}
