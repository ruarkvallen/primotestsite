// Header 78 - Updated March 4, 2024
function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function set_data(text, data) {
    data = '' + data;
    if (text.data === data)
        return;
    text.data = data;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* generated by Svelte v3.59.1 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[6] = list[i].buttontext;
	child_ctx[7] = list[i].buttonlink;
	child_ctx[8] = list[i].buttonstyle;
	child_ctx[10] = i;
	return child_ctx;
}

// (128:12) {#each buttons as { buttontext, buttonlink, buttonstyle }
function create_each_block(ctx) {
	let button;
	let t_value = /*buttonlink*/ ctx[7].label + "";
	let t;
	let button_class_value;

	return {
		c() {
			button = element("button");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			button = claim_element(nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t = claim_text(button_nodes, t_value);
			button_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(button, "class", button_class_value = "btn " + /*buttonstyle*/ ctx[8] + " svelte-1wwzy79");
		},
		m(target, anchor) {
			insert_hydration(target, button, anchor);
			append_hydration(button, t);
		},
		p(ctx, dirty) {
			if (dirty & /*buttons*/ 1 && t_value !== (t_value = /*buttonlink*/ ctx[7].label + "")) set_data(t, t_value);

			if (dirty & /*buttons*/ 1 && button_class_value !== (button_class_value = "btn " + /*buttonstyle*/ ctx[8] + " svelte-1wwzy79")) {
				attr(button, "class", button_class_value);
			}
		},
		d(detaching) {
			if (detaching) detach(button);
		}
	};
}

function create_fragment(ctx) {
	let div3;
	let div2;
	let div1;
	let h1;
	let t0;
	let t1;
	let p;
	let t2;
	let t3;
	let div0;
	let t4;
	let div7;
	let div6;
	let div4;
	let img0;
	let img0_src_value;
	let t5;
	let img1;
	let img1_src_value;
	let t6;
	let img2;
	let img2_src_value;
	let t7;
	let img3;
	let img3_src_value;
	let t8;
	let img4;
	let img4_src_value;
	let t9;
	let img5;
	let img5_src_value;
	let t10;
	let div5;
	let img6;
	let img6_src_value;
	let t11;
	let img7;
	let img7_src_value;
	let t12;
	let img8;
	let img8_src_value;
	let t13;
	let img9;
	let img9_src_value;
	let t14;
	let img10;
	let img10_src_value;
	let t15;
	let img11;
	let img11_src_value;
	let each_value = /*buttons*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div3 = element("div");
			div2 = element("div");
			div1 = element("div");
			h1 = element("h1");
			t0 = text(/*heading*/ ctx[1]);
			t1 = space();
			p = element("p");
			t2 = text(/*description*/ ctx[2]);
			t3 = space();
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t4 = space();
			div7 = element("div");
			div6 = element("div");
			div4 = element("div");
			img0 = element("img");
			t5 = space();
			img1 = element("img");
			t6 = space();
			img2 = element("img");
			t7 = space();
			img3 = element("img");
			t8 = space();
			img4 = element("img");
			t9 = space();
			img5 = element("img");
			t10 = space();
			div5 = element("div");
			img6 = element("img");
			t11 = space();
			img7 = element("img");
			t12 = space();
			img8 = element("img");
			t13 = space();
			img9 = element("img");
			t14 = space();
			img10 = element("img");
			t15 = space();
			img11 = element("img");
			this.h();
		},
		l(nodes) {
			div3 = claim_element(nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div2 = claim_element(div3_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			h1 = claim_element(div1_nodes, "H1", {});
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, /*heading*/ ctx[1]);
			h1_nodes.forEach(detach);
			t1 = claim_space(div1_nodes);
			p = claim_element(div1_nodes, "P", {});
			var p_nodes = children(p);
			t2 = claim_text(p_nodes, /*description*/ ctx[2]);
			p_nodes.forEach(detach);
			t3 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div0_nodes);
			}

			div0_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			t4 = claim_space(nodes);
			div7 = claim_element(nodes, "DIV", { class: true });
			var div7_nodes = children(div7);
			div6 = claim_element(div7_nodes, "DIV", { class: true });
			var div6_nodes = children(div6);
			div4 = claim_element(div6_nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			img0 = claim_element(div4_nodes, "IMG", { src: true, class: true });
			t5 = claim_space(div4_nodes);
			img1 = claim_element(div4_nodes, "IMG", { src: true, class: true });
			t6 = claim_space(div4_nodes);
			img2 = claim_element(div4_nodes, "IMG", { src: true, class: true });
			t7 = claim_space(div4_nodes);
			img3 = claim_element(div4_nodes, "IMG", { src: true, class: true });
			t8 = claim_space(div4_nodes);
			img4 = claim_element(div4_nodes, "IMG", { src: true, class: true });
			t9 = claim_space(div4_nodes);
			img5 = claim_element(div4_nodes, "IMG", { src: true, class: true });
			div4_nodes.forEach(detach);
			t10 = claim_space(div6_nodes);
			div5 = claim_element(div6_nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			img6 = claim_element(div5_nodes, "IMG", { src: true, class: true });
			t11 = claim_space(div5_nodes);
			img7 = claim_element(div5_nodes, "IMG", { src: true, class: true });
			t12 = claim_space(div5_nodes);
			img8 = claim_element(div5_nodes, "IMG", { src: true, class: true });
			t13 = claim_space(div5_nodes);
			img9 = claim_element(div5_nodes, "IMG", { src: true, class: true });
			t14 = claim_space(div5_nodes);
			img10 = claim_element(div5_nodes, "IMG", { src: true, class: true });
			t15 = claim_space(div5_nodes);
			img11 = claim_element(div5_nodes, "IMG", { src: true, class: true });
			div5_nodes.forEach(detach);
			div6_nodes.forEach(detach);
			div7_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div0, "class", "flexh buttongap svelte-1wwzy79");
			attr(div1, "class", "svelte-1wwzy79");
			attr(div2, "class", "flexv image_bottom svelte-1wwzy79");
			attr(div3, "class", "section-container svelte-1wwzy79");
			if (!src_url_equal(img0.src, img0_src_value = "https://placehold.co/400")) attr(img0, "src", img0_src_value);
			attr(img0, "class", "svelte-1wwzy79");
			if (!src_url_equal(img1.src, img1_src_value = "https://placehold.co/400")) attr(img1, "src", img1_src_value);
			attr(img1, "class", "svelte-1wwzy79");
			if (!src_url_equal(img2.src, img2_src_value = "https://placehold.co/400")) attr(img2, "src", img2_src_value);
			attr(img2, "class", "svelte-1wwzy79");
			if (!src_url_equal(img3.src, img3_src_value = "https://placehold.co/400")) attr(img3, "src", img3_src_value);
			attr(img3, "class", "svelte-1wwzy79");
			if (!src_url_equal(img4.src, img4_src_value = "https://placehold.co/400")) attr(img4, "src", img4_src_value);
			attr(img4, "class", "svelte-1wwzy79");
			if (!src_url_equal(img5.src, img5_src_value = "https://placehold.co/400")) attr(img5, "src", img5_src_value);
			attr(img5, "class", "svelte-1wwzy79");
			attr(div4, "class", "imageflexrow svelte-1wwzy79");
			if (!src_url_equal(img6.src, img6_src_value = "https://placehold.co/400")) attr(img6, "src", img6_src_value);
			attr(img6, "class", "svelte-1wwzy79");
			if (!src_url_equal(img7.src, img7_src_value = "https://placehold.co/400")) attr(img7, "src", img7_src_value);
			attr(img7, "class", "svelte-1wwzy79");
			if (!src_url_equal(img8.src, img8_src_value = "https://placehold.co/400")) attr(img8, "src", img8_src_value);
			attr(img8, "class", "svelte-1wwzy79");
			if (!src_url_equal(img9.src, img9_src_value = "https://placehold.co/400")) attr(img9, "src", img9_src_value);
			attr(img9, "class", "svelte-1wwzy79");
			if (!src_url_equal(img10.src, img10_src_value = "https://placehold.co/400")) attr(img10, "src", img10_src_value);
			attr(img10, "class", "svelte-1wwzy79");
			if (!src_url_equal(img11.src, img11_src_value = "https://placehold.co/400")) attr(img11, "src", img11_src_value);
			attr(img11, "class", "svelte-1wwzy79");
			attr(div5, "class", "imageflexrow position2 svelte-1wwzy79");
			attr(div6, "class", "imageflex svelte-1wwzy79");
			attr(div7, "class", "section-container-full svelte-1wwzy79");
		},
		m(target, anchor) {
			insert_hydration(target, div3, anchor);
			append_hydration(div3, div2);
			append_hydration(div2, div1);
			append_hydration(div1, h1);
			append_hydration(h1, t0);
			append_hydration(div1, t1);
			append_hydration(div1, p);
			append_hydration(p, t2);
			append_hydration(div1, t3);
			append_hydration(div1, div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div0, null);
				}
			}

			insert_hydration(target, t4, anchor);
			insert_hydration(target, div7, anchor);
			append_hydration(div7, div6);
			append_hydration(div6, div4);
			append_hydration(div4, img0);
			append_hydration(div4, t5);
			append_hydration(div4, img1);
			append_hydration(div4, t6);
			append_hydration(div4, img2);
			append_hydration(div4, t7);
			append_hydration(div4, img3);
			append_hydration(div4, t8);
			append_hydration(div4, img4);
			append_hydration(div4, t9);
			append_hydration(div4, img5);
			append_hydration(div6, t10);
			append_hydration(div6, div5);
			append_hydration(div5, img6);
			append_hydration(div5, t11);
			append_hydration(div5, img7);
			append_hydration(div5, t12);
			append_hydration(div5, img8);
			append_hydration(div5, t13);
			append_hydration(div5, img9);
			append_hydration(div5, t14);
			append_hydration(div5, img10);
			append_hydration(div5, t15);
			append_hydration(div5, img11);
		},
		p(ctx, [dirty]) {
			if (dirty & /*heading*/ 2) set_data(t0, /*heading*/ ctx[1]);
			if (dirty & /*description*/ 4) set_data(t2, /*description*/ ctx[2]);

			if (dirty & /*buttons*/ 1) {
				each_value = /*buttons*/ ctx[0];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div0, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div3);
			destroy_each(each_blocks, detaching);
			if (detaching) detach(t4);
			if (detaching) detach(div7);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let { layout } = $$props;
	let { buttons } = $$props;
	let { heading } = $$props;
	let { description } = $$props;

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(3, props = $$props.props);
		if ('layout' in $$props) $$invalidate(4, layout = $$props.layout);
		if ('buttons' in $$props) $$invalidate(0, buttons = $$props.buttons);
		if ('heading' in $$props) $$invalidate(1, heading = $$props.heading);
		if ('description' in $$props) $$invalidate(2, description = $$props.description);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*layout*/ 16) ;

		if ($$self.$$.dirty & /*layout*/ 16) ;

		if ($$self.$$.dirty & /*layout*/ 16) ;
	};

	return [buttons, heading, description, props, layout];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			props: 3,
			layout: 4,
			buttons: 0,
			heading: 1,
			description: 2
		});
	}
}

export { Component as default };
