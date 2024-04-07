import { JSONPath } from 'jsonpath-plus';

export function injectData(input: string, data: any): string {
	const matches = input.matchAll(/\${(.*?)}/g);
	let output = input;

	for (const match of matches) {
		const path = match[1];
		const result = JSONPath({ path, json: data });

		if (result.length === 1) {
			output = output.replace(match[0], result[0]);
		}
	}

	return output;
}

export function processLogic(input: string): string {
    const argsRegex = /args\((.*?)\)\[(\d+)\]/g;

    // Check if the input string matches the args regex
    if (argsRegex.test(input)) {
        // If it matches, execute the processing logic
        let output = input.replace(argsRegex, (match, path, index) => {
            // Splitting the string value by spaces
            const parts = path.split(/\s+/);

            // Parsing the index
            const parsedIndex = parseInt(index);

            // Retrieving the value at the specified index
            if (Array.isArray(parts) && parts.length > parsedIndex) {
                return parts[parsedIndex];
            }

            return 'undefined';
        });

        return output;
    } else {
        // If it doesn't match, return the input string unchanged
        return input;
    }
}
