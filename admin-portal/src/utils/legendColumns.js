/**
 * How a legend is laid out once the list outgrows the chart it keys.
 *
 * `Categories.jsx` ships seventeen work-order categories; keyed one per row beside a 120px donut
 * they ran to twice the donut's height, so the card stretched under the key before the chart said
 * anything. The split is width-driven, not a breakpoint guess -- `auto-fill` puts as many 160px
 * columns across as the legend's own width holds, so a legend squeezed beside a chart keeps one
 * column (the old look, which short lists want anyway) while a legend given the card's full width
 * splits into two or three. 160px is the narrowest column that keeps a category name and its
 * figure on one 12px line for most entries.
 *
 * `legendColumns` returns the class string for that count. A caller that needs the same fact for
 * its own layout -- the Work Order Estimates card moves its legend under the donut when the key
 * goes multi-column, because two columns do not fit beside the chart -- reads the same function
 * rather than hard-coding the threshold a second time, which is the drift this file exists to
 * prevent.
 */
export const LEGEND_SPLIT_AT = 9;

const ONE_COLUMN = 'space-y-1.5';
const MANY_COLUMNS = 'grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-4 gap-y-1.5';

export const legendSplits = (count) => count >= LEGEND_SPLIT_AT;
export const legendColumns = (count) => (legendSplits(count) ? MANY_COLUMNS : ONE_COLUMN);

export default { LEGEND_SPLIT_AT, legendSplits, legendColumns };
