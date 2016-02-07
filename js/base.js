/*jslint continue: true, plusplus: true, regexp: true, vars: true*/
/*global jQuery, alert, console, navigator, MutationObserver, NodeList */

var baseObj = (function () {
    "use strict";
	/* methods */
	var cons,
		init,
		AjaxObj,
		openArea,
		closeArea,
		createDom,
		getReplyLoop,
		getReply,
		viewReplies,
		viewError,
		setEvent,
		checkDomChange;
	
	/* main dom obj */
	var tgt,
		loader,
		toggle,
		limit,
		outer,
		inner,
		contents;
	
    /* var flags*/
    var requestFlag = false,
		stack = [],
		selfMsg = {},
		prefix = "cw_reply_tracer_extention",
		token = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";	// APIトークン

	// console.log出力
	cons = function (obj) {
		console.log(obj);
		return true;
	};
	
	// ajaxオブジェクト
	AjaxObj = function (obj) {
		this.url = obj.url;
		this.action = obj.func;
		this.action_false = obj.func_false;
		this.type = obj.type;
		this.headers = obj.headers;
	};
	AjaxObj.prototype.call = function () {
		var action = this.action,
			action_false = this.action_false;
		jQuery.ajax({
			type: this.type,
			url: this.url,
			headers: this.headers,
			json: true
		}).done(function (data, status, xhr) {
			if (xhr.status === 200) {
				action(data, status, xhr);
			} else {
				viewError(data.responseText);
				action_false();
			}
			return true;
		}).fail(function (data, status, xhr) {
			viewError(data.responseText);
			action_false();
			return false;
		}).always(function () {
			return true;
		});
	};
	
    // 表示エリア open close
	openArea = function () {
		tgt.addClass("active");
	};
	closeArea = function () {
		tgt.removeClass("active");
	};
	
    // dom作成
	createDom = function () {
		tgt = jQuery(document.createElement('div')).attr("id", prefix + "-id");
		toggle = jQuery(document.createElement('div')).attr("id", prefix + "-toggle");
		limit = jQuery(document.createElement('div')).attr("id", prefix + "-limit");
		loader = jQuery(document.createElement('div')).attr("id", prefix + "-loader");
		outer = jQuery(document.createElement('div')).attr("id", prefix + "-outer");
		inner = jQuery(document.createElement('div')).attr("id", prefix + "-inner");
		contents = jQuery(document.createElement('div')).attr("id", prefix + "-contents");
		
		inner.append(contents);
		outer.append(inner);
		tgt.append(outer);
		tgt.append(loader);
		tgt.append(toggle);
		tgt.append(limit);
		
		jQuery("body").append(tgt);
	};
	
    // 取得したリプライコメントを出力
	viewReplies = function (rid) {
		if (stack.length === 0 || !rid) {
			return false;
		}
		
		var wrapper = jQuery(document.createElement('div')).addClass(prefix + "-wrapper"),
			i,
			len;
		
		// コメントindexの作成
		stack.reverse();
		for (i = 0, len = stack.length; i < len; i++) {
			var dom = jQuery(document.createElement('div')).addClass(prefix + "-index"),
				dombody = stack[i].body.replace(/\[rp aid=[0-9]+ to=[0-9]+-[0-9]+\]/g, "").replace(/\[To:[0-9]+\]/g, "");
			dom.html(
				"<h3>" + stack[i].account.name + "</h3>"
					+ '<pre><div class="' + prefix + '-index-text">' + dombody + '</div></pre>'
					+ '<div class="' + prefix + '-index-postlink"><a href="https://www.chatwork.com/#!rid' + rid + '-' + stack[i].message_id + '" target="_blank">&raquo; この投稿を開く</a></div>'
			);
			wrapper.append(dom);
		}
		
		// リプライ元のHTMLからindexを作成
		var selfdom = jQuery(document.createElement('div')).addClass(prefix + "-index " + prefix + "-index-self"),
			selfdombody = selfMsg.body.replace(/RE /g, "");
		selfdom.html(
			"<h3>" + selfMsg.name + "</h3>" +
				'<pre><div class="' + prefix + '-index-text">' + selfdombody + "</div></pre>"
		);
		wrapper.append(selfdom);
		contents.prepend(wrapper);
		
		// 表示
		setTimeout(function () {
			wrapper.addClass("active");
			stack = [];
			selfMsg = {};
			loader.removeClass("active");
		}, 50);
	};
	
	// エラー内容を出力
	viewError = function (txt) {
		var wrapper = jQuery(document.createElement('div')).addClass(prefix + "-wrapper " + prefix + "-wrapper-error"),
			dom = jQuery(document.createElement('div')).addClass(prefix + "-index");
		dom.html('<pre><div class="' + prefix + '-index-text">' + txt + '</div></pre>');
		wrapper.append(dom);
		contents.prepend(wrapper);
		requestFlag = false;
		setTimeout(function () {
			wrapper.addClass("active");
			loader.removeClass("active");
		}, 50);
	};
	
	// リプライ取得再帰
	getReplyLoop = function (rid, mid) {
		var succesFunc = function (data, status, xhr) {
			// APIの残り回数変更
			limit.text("API Limit : " + xhr.getResponseHeader("X-RateLimit-Remaining") + "/" + xhr.getResponseHeader("X-RateLimit-Limit"));
			
			if (data.error) {
				viewError(data.error);
				return false;
			}
			stack.push(data);
			
			// replyがbody内にあるかどうかチェック
			var matchtxt = data.body.match(/\[rp aid=[0-9]+ to=[0-9]+-[0-9]+\]/);
			if (matchtxt) {
				var new_mid = matchtxt[0].match(/-[0-9]+\]/)[0].replace("-", "").replace("]", "");
				setTimeout(function () {
					getReplyLoop(rid, new_mid);
				}, 300);
			} else {
				viewReplies(rid);
				requestFlag = false;
				return true;
			}
		};

		var falseFunc = function () {
			return false;
		};

		var getInfo = new AjaxObj({
			url: "https://api.chatwork.com/v1/rooms/" + rid + "/messages/" + mid,
			headers: {
				'X-ChatWorkToken': token
			},
			func: succesFunc,
			func_false: falseFunc,
			type: 'GET',
			json: true
		});
		
		getInfo.call();
	};

	// traceボタンをクリックした時のイベント
	getReply = function () {
		openArea();
		if (requestFlag) {
			cons('requesting...');
			return false;
		}
		requestFlag = true;
		loader.addClass("active");
		var rid = this.getAttribute("data-rid"),
			mid = this.getAttribute("data-mid");
		
		// クリックした投稿をstack
		var selfWrap = jQuery(this).parent(),
			selfName = selfWrap.find("div.chatTimeLineItemHeader > .chatName > span").text(),
			selfBody = selfWrap.children("pre").text();
		
		// 連続投稿で名前が前のポスト気にある時の検索ループ
		var nameSearchLoop = function (postWrap) {
			var tmp = postWrap.find("div.chatTimeLineItemHeader > .chatName > span");
			if (!tmp) {
				nameSearchLoop();
			} else {
				selfName = tmp.text();
			}
		};
		
		if (!selfName) {
			nameSearchLoop(selfWrap.parent().parent().prev());
		}
		
		selfMsg.name = selfName;
		selfMsg.body = selfBody;
		
		getReplyLoop(rid, mid);
	};

	// traceボタン DOMの構築
	setEvent = function () {
		var repBtns = jQuery("#_timeLine").find("div.chatTimeLineReply"),
			i,
			len;
		
		if (repBtns.length === 0) {
			return false;
		}
		
		for (i = 0, len = repBtns.length; i < len; i++) {
			var repobj = jQuery(repBtns[i]),
				repobjParent = repobj.parent();
			// 引用枠内のREボタンはスルー
			if (repobjParent.hasClass("quoteText")) {
				continue;
			}
			
			// traceボタンの座標調整
			var repBtnTop = repobj.position().top + 12;
			
			// DOM
			var rid = repobj.attr("data-rid"),
				mid = repobj.attr("data-mid"),
				dom = jQuery(document.createElement('div'))
					.addClass(prefix + "-btn")
					.attr("data-rid", rid)
					.attr("data-mid", mid)
					.css({top: repBtnTop + "px"})
					.on("click", {}, getReply)
					.html("trace");
			repobjParent.parent().append(dom);
		}
		
		// 表示エリアを閉じるボタンのイベント
		toggle.on("click", {}, closeArea);
	};
	
	// タイムラインHTMLの変更を監視
	checkDomChange = function () {
		var observeTgt = document.getElementById("_timeLine");
		var observer = new MutationObserver(function (mrecords, mobserver) {
			var checkChange = function (x) {
				if (x.addedNodes &&
					x.addedNodes instanceof NodeList &&
					x.addedNodes.length > 0 &&
					x.type === 'childList') {
					return true;
				}
				return false;
			};
			if (mrecords.some(checkChange)) {
				setEvent();
			}
		});
		
		// 子要素のみを対象、孫要素以下は検知しない
		observer.observe(observeTgt, {childList: true, subtree: false});
	};

    // initialize
	init = function () {
		createDom();
		setEvent();
		checkDomChange();
    };

	return {
		init: init
	};
    
}());

jQuery(window).load(function () {
	"use strict";
	baseObj.init();
});
