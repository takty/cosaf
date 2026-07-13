/**
 * Script for Sample
 *
 * @author Takuto Yanagida
 * @version 2026-07-13
 */

// @ts-expect-error Vite handles CSS imports.
import 'klales/klales.min.css';
import { ColorUtil } from 'iroay/iroay';
import { Scheme, SolverType } from '../../cosaf';
import { Vision } from '../vision';
import { waitFor, createLogOutput } from './util.js';

const TARGET     = 0.8;
const TIME_LIMIT = 4000;

type VisionKey = 'T' | 'P' | 'D' | 'M';

type PairInfo = {
	i: number;
	j: number;
	diff: number;
};

type WorkerResult = {
	colors: number[] | null;
	quality: number | null;
	time: number;
};

const VISION: Record<VisionKey, Vision> = {
	T: Vision.TRICHROMACY,
	P: Vision.PROTANOPIA,
	D: Vision.DEUTERANOPIA,
	M: Vision.MONOCHROMACY,
};

const DEFAULT_COLORS: string[] = ['#ff0000', '#009900', '#000099'];

let colors: string[] = [...DEFAULT_COLORS];
let modified: Scheme | null = null;

document.addEventListener('DOMContentLoaded', (): void => {
	const addColor = document.getElementById('add-color') as HTMLButtonElement;
	const adjust   = document.getElementById('adjust') as HTMLButtonElement;
	const stop     = document.getElementById('stop') as HTMLButtonElement;

	const target = document.getElementById('target') as HTMLInputElement;
	target.value = '' + TARGET;
	const targetOn = document.getElementById('target-on') as HTMLInputElement;

	const timeLimit = document.getElementById('time-limit') as HTMLInputElement;
	timeLimit.value = '' + TIME_LIMIT;
	const timeLimitOn = document.getElementById('time-limit-on') as HTMLInputElement;

	const bnOn    = document.getElementById('bn-on') as HTMLInputElement;
	const debugOn = document.getElementById('debug-on') as HTMLInputElement;
	const output  = document.getElementById('output') as HTMLTextAreaElement;
	const message = document.getElementById('message') as HTMLElement;
	const log: (e: unknown) => void = createLogOutput();

	let worker: Worker | null = null;
	let count = 0;

	addColor.addEventListener('click', (): void => {
		colors.push('#ffffff');
		modified = null;
		render();
	});

	for (const r of document.querySelectorAll<HTMLInputElement>('input[name="vision"]')) {
		r.addEventListener('change', render);
	}

	adjust.addEventListener('click', (): void => {
		adjust.disabled     = true;
		stop.disabled       = false;
		addColor.disabled   = true;
		message.textContent = 'Adjusting...';
		output.value        = '';
		modified            = null;
		render();

		worker = new Worker(new URL('worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (e: MessageEvent<unknown>): void => {
			const data = e.data;
			if (!isObject(data)) return;

			if ('log' in data) {
				log(data.log);
				return;
			}
			if ('error' in data) {
				log(`Error: ${String(data.error)}`);
				finish('An error occurred.');
				return;
			}
			if ('result' in data && isWorkerResult(data.result)) {
				const result = data.result;

				if (result.colors && result.quality !== null) {
					modified = new Scheme(result.colors, null, null, result.quality);
				}
				finish(modified ? 'Adjusted.' : 'No solution found.');
			}
		};
		worker.onerror = (e: ErrorEvent): void => {
			log(`Worker error: ${e.message}`);
			finish('An error occurred.');
		};

		void start(
			worker,
			colors.map(colorToInteger),
			targetOn.checked ? parseFloat(target.value) : null,
			timeLimitOn.checked ? parseInt(timeLimit.value) : null,
			bnOn.checked,
			debugOn.checked
		);
	});

	stop.addEventListener('click', (): void => {
		finish('Stopped.');
	});

	function finish(text: string): void {
		worker?.terminate();
		worker              = null;
		adjust.disabled     = colors.length < 2;
		stop.disabled       = true;
		addColor.disabled   = false;
		message.textContent = text;
		render();
	}

	async function start(
		ww            : Worker,
		sourceColors  : number[],
		targetValue   : number | null,
		timeLimitValue: number | null,
		bnResolved    : boolean,
		debug         : boolean
	): Promise<void> {
		ww.postMessage({
			task: 'adjust',
			args: [{
				colors    : sourceColors,
				solverType: SolverType.FC,
				target    : targetValue,
				timeLimit : timeLimitValue,
				bnResolved: bnResolved,
				debug,
			}],
		});
		await waitFor((): boolean => worker !== ww);
	}
	render();
});

function currentVisionKey(): VisionKey {
	const checked = document.querySelector<HTMLInputElement>('input[name="vision"]:checked');
	return (checked?.value ?? 'T') as VisionKey;
}

function currentVision(): Vision {
	return VISION[currentVisionKey()];
}

function render(): void {
	renderEditors();

	const schemes = document.querySelector<HTMLElement>('#schemes');
	if (!schemes) return;
	schemes.textContent = '';

	const original = new Scheme(colors.map(colorToInteger));
	schemes.appendChild(createSchemePanel('Original', original, currentVision(), null));

	if (modified) {
		schemes.appendChild(createSchemePanel('Adjusted', modified, currentVision(), original));
	}

	const adjust = document.querySelector<HTMLButtonElement>('#adjust');
	if (adjust && !document.querySelector<HTMLButtonElement>('#stop')?.disabled) return;
	if (adjust) adjust.disabled = colors.length < 2;
}

function renderEditors(): void {
	const editors = document.querySelector<HTMLElement>('#editors');
	if (!editors) return;
	editors.textContent = '';

	const running = !(document.querySelector<HTMLButtonElement>('#stop')?.disabled ?? true);

	colors.forEach((color, index): void => {
		const editor = document.createElement('div');
		editor.className = 'editor';

		const label = document.createElement('label');
		label.textContent = `#${index}`;

		const input = document.createElement('input');
		input.type     = 'color';
		input.value    = color;
		input.disabled = running;
		input.addEventListener('input', (): void => {
			colors[index] = input.value;
			modified = null;
			render();
		});

		const remove = document.createElement('button');
		remove.type        = 'button';
		remove.textContent = 'x';
		remove.disabled    = running || colors.length <= 2;
		remove.addEventListener('click', (): void => {
			colors.splice(index, 1);
			modified = null;
			render();
		});

		editor.append(label, input, remove);
		editors.appendChild(editor);
	});
}

function colorToInteger(color: string): number {
	const c = ColorUtil.fromString(color);
	if (!c) throw new RangeError(`Invalid color: ${color}`);
	return c.asInteger();
}

function integerToHex(value: number): string {
	return `#${(value & 0xffffff).toString(16).padStart(6, '0')}`;
}

function createSchemePanel(title: string, scheme: Scheme, vision: Vision, original: Scheme | null): HTMLElement {
	const panel = document.createElement('section');
	panel.className = 'scheme';

	const heading = document.createElement('h2');
	heading.textContent = title;
	panel.appendChild(heading);

	const analysis = analyze(scheme, vision);

	const swatches = document.createElement('div');
	swatches.className = 'swatches';

	for (let i = 0; i < scheme.size(); ++i) {
		const swatch = document.createElement('div');
		swatch.className = 'swatch';
		if (analysis.minimum && (analysis.minimum.i === i || analysis.minimum.j === i)) {
			swatch.classList.add('minimum');
		}
		swatch.style.backgroundColor = integerToHex(scheme.getColor(i, vision).asInteger());
		swatch.textContent = `#${i}`;
		swatches.appendChild(swatch);
	}
	panel.appendChild(swatches);

	const stats = document.createElement('div');
	stats.className = 'stats';
	stats.appendChild(document.createTextNode(`Min. Δ${visionLabel(vision)}: ${analysis.minimum ? analysis.minimum.diff.toFixed(2) : '-'}`));
	stats.appendChild(document.createElement('br'));
	stats.appendChild(document.createTextNode(`Min. pair: ${analysis.minimum ? `#${analysis.minimum.i} - #${analysis.minimum.j}` : '-'}`));

	if (original) {
		stats.appendChild(document.createElement('br'));
		stats.appendChild(document.createTextNode(`Quality: ${scheme.getQuality().toFixed(3)}`));
		stats.appendChild(document.createElement('br'));
		stats.appendChild(document.createTextNode(`Total ΔE from original: ${scheme.totalDifferenceFrom(original).toFixed(2)}`));
	}
	panel.appendChild(stats);

	panel.appendChild(createPairTable(analysis.pairs, analysis.minimum));

	return panel;
}

function analyze(scheme: Scheme, vision: Vision): { pairs: PairInfo[], minimum: PairInfo | null } {
	const pairs: PairInfo[] = scheme.getAdjacencies().map(([i, j]): PairInfo => {
		return { i, j, diff: scheme.getDifference(i, j, vision) };
	});

	let minimum: PairInfo | null = null;
	for (const pair of pairs) {
		if (!minimum || pair.diff < minimum.diff) {
			minimum = pair;
		}
	}
	return { pairs, minimum };
}

function createPairTable(pairs: PairInfo[], minimum: PairInfo | null): HTMLElement {
	const table = document.createElement('table');

	const thead = document.createElement('thead');
	const header = document.createElement('tr');
	for (const text of ['Pair', 'Δ']) {
		const th = document.createElement('th');
		th.textContent = text;
		header.appendChild(th);
	}
	thead.appendChild(header);
	table.appendChild(thead);

	const tbody = document.createElement('tbody');
	for (const pair of pairs) {
		const tr = document.createElement('tr');
		if (minimum && pair.i === minimum.i && pair.j === minimum.j) {
			tr.className = 'minimum';
		}

		const pairCell = document.createElement('td');
		pairCell.textContent = `#${pair.i} - #${pair.j}`;

		const diffCell = document.createElement('td');
		diffCell.textContent = pair.diff.toFixed(2);

		tr.append(pairCell, diffCell);
		tbody.appendChild(tr);
	}
	table.appendChild(tbody);

	return table;
}

function visionLabel(vision: Vision): string {
	switch (vision) {
		case Vision.PROTANOPIA  : return 'P';
		case Vision.DEUTERANOPIA: return 'D';
		case Vision.MONOCHROMACY: return 'M';
		default                 : return 'T';
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isWorkerResult(value: unknown): value is WorkerResult {
	if (!isObject(value)) return false;
	return (
		(Array.isArray(value.colors) || value.colors === null) &&
		(typeof value.quality === 'number' || value.quality === null) &&
		typeof value.time === 'number'
	);
}
