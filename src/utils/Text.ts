import chalk from 'chalk';

export const PILL = '•';
export const COLORS = {
	RED: 'red',
	GREEN: 'green',
	BLUE: 'blue',
	YELLOW: 'yellow',
	MAGENTA: 'magenta',
	GRAY: 'gray'
};

export function coloredPill(color: string): string {
	return colorizeText(`${PILL}`, color);
}

export function colorizeText(text: string, color: string): string {
	color = color.toLowerCase();

	// Check if the provided color is supported
	if (!Object.values(COLORS).includes(color)) {
		console.error(`Unsupported color: ${color}. Defaulting to white.`);
		color = 'white'; // Default to white if the color is not supported
	}

	// Dynamically apply the selected color
	const coloredText = chalk[color](text);

	return coloredText;
}

export function replaceAndCapitalize(str: string): string {
	const words = str.split('-');
	const capitalizedWords = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
	return capitalizedWords.join(' ');
}
