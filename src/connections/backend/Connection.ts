export interface WebHookInfo {
	host: string;
	port: number;
	apiKey: string;
}

export interface WebSocketInfo {
	url: string;
}

export class ConnectionConfig {
	constructor(
		public id: string,
		public enabled: boolean,
		public name: string,
		public description: string,
		public type: string,
		public info: WebHookInfo | WebSocketInfo
	) {}

	static fromJson(json: string): ConnectionConfig {
		const data = JSON.parse(json);
		return new ConnectionConfig(
			data.id,
			data.enabled,
			data.name,
			data.description,
			data.type,
			data.connection
		);
	}
}
