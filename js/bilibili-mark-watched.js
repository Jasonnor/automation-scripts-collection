// ==UserScript==
// @name         Bilibili Mark Watched
// @namespace    BiliSearchViewed
// @version      3.3.1
// @description  Manually mark watched videos on Bilibili so watched and unwatched ones are easy to tell apart. Covers home, video, history, watch later, user space, and search. Other pages are left alone.
// @author       Jasonnor, Truazusa
// @match        https://search.bilibili.com/*
// @match        https://space.bilibili.com/*
// @match        https://t.bilibili.com/*
// @match        https://www.bilibili.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bilibili.com
// @require      https://static.hdslb.com/js/jquery.min.js
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// ==/UserScript==

// 0 is invisible and 1 is opaque.
// Watched cover.
var opacityIsViewCover = 0.1;
// Unwatched button.
var opacitybtnView = 0.7;
// Watched button.
var opacitybtnIsView = 0.3;

var GM_addStyle = GM_addStyle || function(css) {
  var style = document.createElement("style");
  style.type = "text/css";
  style.appendChild(document.createTextNode(css));
  document.getElementsByTagName("head")[0].appendChild(style);
};

let staticStyle = `
.btnView{opacity:`+opacitybtnView+`;background:#fff;color:#999!important;width:fit-content;line-height:16px;font-size:12px;text-align:center;cursor:pointer;display:inline-block;position:absolute;left:0;top:0;z-index:2;border:1px solid #999;border-radius:3px;padding:3px 5px;}
.btnIsView{opacity:`+opacitybtnIsView+`;background:#fff8;}
.btnView:hover{opacity:1;background:#aaa;color:#fff!important;}
.btnIsView:hover{background:#fff;opacity:1;color:#999!important;}
.btnSetAllViewed,.btnRefresh{display:inline-block;background:#fff;font-size:14px;border:1px solid #999;border-radius:5px;color:#999;padding:3px 5px;cursor:pointer;word-break:keep-all;}
.btnSetAllViewed:hover,.btnRefresh:hover{background:#aaa;color:#fff;}`;

var searchStyle = `
/*Search results*/
.btnList{display:inline-block;background:#fff;border:1px solid #999;border-radius:5px;color:#999;padding:3px 5px;cursor:pointer;}
.btnList:hover{background:#aaa;color:#fff;}
.btnListSave{display:inline-block;display:none;background:#fff;border:1px solid #999;border-radius:5px;color:#999;padding:3px 5px;cursor:pointer;}
.btnListSave:hover{background:#aaa;color:#fff;}
.viewList{width:100%;height:120px;margin:10px 0;display:none;color:#999;padding:3px 5px;}
.btnList{position:absolute;top:11px;right:0;}
.btnListSave{position:absolute;top:11px;right:83px;}
.search-input .search-input-container .search-input-wrap{margin:0 10px 0 0;}
/*Bangumi search results*/
.media-card-content-footer-btns{height:45px!important;}
.p_relativeSpan{position:relative;padding:0 0 22px;display:inline-block;}
.p_relativeSpan .btnView{left:-1px;top:unset;bottom:0;position:absolute;border:none;}
.media-footerClone{position:absolute;}
.media-footerClone a{margin-right:8px;}
.media-footerClone .media-footer-badge{top:-14px;}
.bangumi-pgc-list .media-item{overflow-y:auto;}
.media-card>.btnView{left:8px;}
.media-card-image-follow[data-v-402c7b9e]{top:22px;}
/*Variety search results*/
.selConSpan{position:relative;}
.selConSpan .btnView{top:8px;left:4px;}
.media-footer-select-content-item{padding:0 6px 0 48px!important;}
`;

const spaceStyle = `
/*User space*/
.btnRefresh{margin:0 0 0 16px;line-height:20px;}
.n-inner .btnRefresh{top:5px;position:relative;}
/*Space home: their videos and collections*/
.small-item .cover{background:none!important;}
.small-item .btnView{top:10px;left:10px;}
/*Space home: their videos*/
#page-index .video .small-item:nth-child(4n+1) .btnView{left:0;}
/*Space home: a collection*/
.channel-video .small-item:nth-child(4n+1) .btnView{left:0;}
/*Dynamics*/
.bili-dyn-content__orig__major{position:relative;}
/*Uploads, list layout*/
#submit-video-list .list-list .btnView{top:20px;left:0;}
/*Collections, list layout*/
.series-item .btnView{top:10px;left:10px;}
/*Collection detail after More*/
.channel-detail .btnView{top:20px;}
/*Favorites*/
.fav-video-list .btnView{top:0;left:0;z-index:9;}
/*Keep the button above the cover preview that plays on hover.*/
.bili-video-card .btnView{z-index:101;}
`;

const historyStyle = `
/*History*/
.btnView{left:unset;right:0;}
.btnSetAllViewed,.btnRefresh{line-height:22px;margin-right:16px;}
`;

var videoStyle = `
/*Video page*/
/*Main video info bar*/
.video-info-detail-list .pubdate-ip .btnView{position:unset;margin:0 0 0 10px;border:none;width:35px;}
/*Recommendations shown after playback ends*/
.bpx-player-ending-related-itemDiv{position:relative;float:left}
.bpx-player-ending-related-itemDiv .btnView{opacity:0.9;}
.bpx-player-ending-related-itemDiv .btnIsView{opacity:0.7;}
/*Toolbar under the main video*/
.video-toolbar-right .btnRefresh{line-height:22px;}
/*Subscribed collection or part list, with a cover or a title only*/
.normal-base-item .cover,.simple-base-item{position:relative;}
.simple-base-item .btnView{top:4px;left:4px;}
.simple-base-item.normal,.simple-base-item.head{padding:0 10px 0 48px;}
.page-list .page-item{padding:0 10px 0 65px;}
.page-list .page-item .btnView{left:20px;}
/*Part list, grid of numbered titles*/
.rcmd-tab .video-pod .video-pod__body .video-pod__list.multip.grid>.page{padding-bottom:25px;height:50px;}
.page{position:relative;}
.page .btnView{position:absolute;bottom:0;top:unset;left:6px;width:32px;}
`;

var festivalVideoStyle = `
/*Festival video page*/
.video-section-title{z-index:3!important;}
.video-episode-card__cover .btnView{line-height:12px;width:25px;}
.recommend-video-card{position:relative;}
.recommend-video-card .btnView{right:unset;top:6px;line-height:12px;width:25px;}
.video-toolbar-content_right .btnRefresh{position:relative;top:0;right:15px;line-height:21px;border-radius:2px;}
.video-toolbar-content_left .btnView{position:relative;line-height:16px;height:16px;top:9px;}`;

var watchlaterStyle = `
/*Watch later list*/
.btnView{left:unset;right:0;z-index:201;}
.btnSetAllViewed,.btnRefresh{font-size:14px;line-height:22px;}
`;

var listPlayStyle = `
/*Watch later player*/
.tip-info .btnRefresh{font-size:12px;position:absolute;right:0;}
.player-auxiliary-playlist-item{position:relative;}
.player-auxiliary-playlist-item .btnView{position:absolute;top:6px;left:65px;}
.player-auxiliary-playlist-item:first-child .btnView{top:0;}
/*Watch later player, older layout*/
.main .btnView{left:0;width:25px;line-height:12px;}
.multip-list-item .left-part{position:relative;padding:0 0 0 40px;}
.multip-list .multip-list-item-active[data-v-079b367a]{padding:0 10px;}
.multip-list-item .btnView{left:0;width:25px;line-height:12px;}
.video-info-detail-list .btnView{position:unset;margin:0;border:none;width:35px;}
.video-toolbar-right .btnRefresh{right:0;top:0;position:relative;}
.video-info-detail-list .pubdate-ip .btnView{position:unset;margin:0 0 0 10px;border:none;width:35px;}
`;

var popularStyle = `
/*Popular, weekly picks, and must-watch*/
.popular-video-container .btnView{width:40px}
.weekly-list .weekly-header .panel{z-index:2;}
/*Ranking*/
.popular-container .rank-container .rank-list .rank-item .btnView{font-size:14px;width:45px;height:24px;}
/*Sitewide music chart*/
._card_1kuml_6 .btnView{top:unset;left:12px;bottom:72px;border:1px solid #999;font-size:12px;}
/*Short-drama chart*/
.drama-board-listClone{justify-content:space-between;flex-wrap:wrap;display:flex;height:0;}
.board-item-wrapDiv{margin-bottom:30px;position:relative;float:left;}
.board-item-wrapDiv .btnView{right:unset;top:16px;left:182px;}`;

var indexStyle = `
/*Home*/
`;

var channelStyle = `
/*Channel*/
.card-list .btnView{left:unset;top:0;right:0;width:40px;}`;

var bangumiStyle = `
/*Bangumi player*/
.toolbar_toolbar__NJCNy .btnRefresh{right:0;cursor:pointer;}
.toolbar .btnRefresh{right:0;top:14px;cursor:pointer;}

.toolbar_toolbar__NJCNy .btnView{right:unset;width:36px;top:20px;border:none;}
.toolbar .btnView{right:60px;width:36px;top:19px;border:none;}

/*Episode list, list layout*/
.longListItem_wrap__9OsZi .btnView{right:unset;position:relative;width:36px;margin:0 7px 0 0;}
/*Episode list, grid layout*/
.numberListItem_number_list_item__wszA4 a{height:18px;}
.numberListItem_number_list_item__wszA4 .btnView{width:32px;padding:0;border-radius:1px;right:unset;left:0;border:none;}
/*PVs and extras*/
.epitem_ep_item__CPdZy .btnView{width:36px;height:24px;position:relative;float:left;margin:3px 5px 0 0;text-align:center;color:#aaa;}
.epitem_ep_item__CPdZy .btnView:hover{color:#fff;background:#aaa;}
/*Series*/
.seasonlist_ss_info__Yc7YV{width:130px;}
.seasonlist_ss_item__czhHy .btnView{height:24px;width:40px;position:relative;right:280px;}
/*Related videos*/
.RecommendItem_wrap__pJmXL{position:relative;}
.RecommendItem_wrap__pJmXL .btnView{height:22px;width:40px;position:absolute;right:unset;}
.RecommendItem_wrap__pJmXL .RecommendItem_cover__Rc3y2{background:none;}`;

var cheeseStyle = `
/*Course home*/
.block-list-item{position:relative;}
.rank dd{position:relative;}
.rank dd .btnView{right:unset;left:28px;line-height:12px;width:25px;}
.common-lazy-img{background:none;}
/*Course category search*/
.big-card .btnView{right:unset;left:0;}`;

var cheesePlayStyle =`
/*Course player*/
.section-item .btnView{line-height:12px;width:25px;left:2px;bottom:7px;top:unset;border:none;}
.layout-r .btnRefresh{position:relative;top:0;right:0;cursor:pointer;line-height:24px;margin:0 0 0 10px;}
.layout-l .btnView{position:relative;border:none;}
/*Related videos*/
.season-recommend-card{position:relative;}
.season-recommend-card .btnView{right:unset;line-height:12px;width:25px;}`

var areaStyle = `
/*Section home, or the ranking on the right of home*/
.bili-rank-list-video__item--wrap{position:relative;}
.bili-rank-list-video__item--wrap .btnView{right:-8px;color:#aaa;border:1px solid #aaa;}
.bili-rank-list-cheese__item--wrap .btnView{color:#aaa;border:1px solid #aaa;}
.bili-rank-list-ogv__item--wrap .btnView{color:#aaa;border:1px solid #aaa;}`;

var varietyStyle = `
/*Variety home*/
.side-item{position:relative;}
.side-item .btnView{width:25px;line-height:12px;}
.hot-item{position:relative;}
.column-itemDiv{-webkit-box-flex:1;flex:1;margin:0 16px 0 0;border-radius:8px;overflow:hidden;position:relative;}
.column-itemDiv .btnView{right:unset;left:0;}
.hover-item .btnView{right:unset;z-index:3;}
.web_rank_v2 .hover-item .btnView{right:0;}
/*Variety index*/
.bangumi-item{position:relative;}
.bangumi-item .btnView{right:unset;left:0;}`;

var guochangStyle = `
/*Chinese animation*/
.progress-bar-content .btnView{top:4px;right:4px;border-radius:7px;}
.timeline-weekday-hover-item .btnView{z-index:10;right:unset;}
.ranking-ratio-item-container .btnView{z-index:10;right:unset;}
/*Chinese animation subsection*/
.spread-module .lazy-img{background:none;}
.spread-module .btnView{width:25px;line-height:12px;}
.sec-rank .rank-item .btnView{width:25px;line-height:12px;right:unset;}
.rank-list .rank-item.show-detail .ri-detail{padding:0 0 0 40px;}
.rank-list .rank-item.show-detail.highlight .ri-detail{padding:0;}
.rank-list .rank-item.show-detail a:hover .ri-detail{padding:0;}
/*Chinese animation index*/
.bangumi-item{position:relative;}
.bangumi-item .btnView{right:unset;}
.bangumi-item .common-lazy-img{background:none;}
.rank-item .lazy-img{background:none;}`;

let setMethod = null;
let timer = null;
let viewVideoList = null;
const btnRefresh = $("<a class='btnRefresh' title='如果列表没出现已看/未看标识，请手动点击这个按钮进行刷新'>刷新</a>");
let btnSetAllViewed = null;
GM_addStyle(staticStyle);
$(document).ready(function(){
  pageHeight = $(window).height() * 0.66;
  var domain = location.href;
  var askIndex = domain.indexOf("?");
  if(askIndex > -1){
    domain = domain.substring(0,askIndex);
  }
  domain = domain.toLowerCase();
  if(domain.indexOf("search.") > -1){
    // Search
    GM_addStyle(searchStyle);
    setMethod = setSearchPage;
    setPageScrollMethod();
  }else if(domain.indexOf("space.") > -1){
    // User space
    GM_addStyle(spaceStyle);
    setMethod = setSpacePage;
  }else if(domain.indexOf("t.") > -1){
    // Dynamics feed
    GM_addStyle(spaceStyle);
    setMethod = setSpacePage;
    setPageScrollMethod();
    if($(".bili-dyn-up-list__item").length == 0){
      // Avatars are not in the DOM yet. Bind again after 2 seconds.
      setTimeout(function(){
        $(".bili-dyn-up-list__item").unbind("click").click(function(){
          prePageScrollTop = 0;
          setTimeout(setPageRefreshMethod,2000);
        })
      },2000);
    }
  }else if(domain.indexOf("www.") > -1){
    // Main site
    var href = location.href;
    href = href.toLowerCase();
    if(href.indexOf("/bangumi/play/") > -1){
      // Bangumi player
      GM_addStyle(bangumiStyle);
      setMethod = setBangumiPage;
    }else if(href.indexOf("/cheese/play/") > -1){
      // Course player
      GM_addStyle(cheesePlayStyle);
      setMethod = setCheesePlayPage;
    }else if(href.indexOf("/cheese/") > -1){
      // Course home
      GM_addStyle(cheeseStyle);
      setMethod = setCheesePage;
    }else if(href.indexOf("/guochuang") > -1 || href.indexOf("/anime") > -1){
      // Bangumi and Chinese animation sections
      GM_addStyle(guochangStyle);
      setMethod = setGuochuangPage;
      setPageScrollMethod();
    }else if(href.indexOf("/v/musicplus") > -1){
      // New-song chart
      GM_addStyle(indexStyle);
      setMethod = setMusicplusPage;
    }else if(href.indexOf("/play/watchlater") > -1){
      // /play/watchlater redirects to /list/watchlater.
      return;
    }else if(href.indexOf("/list/") > -1){
      // List player
      // Watch later Play All opens /list/watchlater.
      // A favorite Play All opens /list/mlxxxxx.
      GM_addStyle(listPlayStyle);
      setMethod = setListPlayPage;
      // Watch later list has its own scroller.
      $("#playlist-video-action-list").scroll(function(){
        var curScrollTop = $("#playlist-video-action-list").scrollTop();
        if(Math.abs(curScrollTop - preScrollTop) > 300){
          preScrollTop = curScrollTop;
          setTimeout(function(){setMethod();},1000)
        }
      })
      setPageScrollMethod();
      // Expanding related videos loads more cards.
      $(".rec-footer").click(function(){
        setTimeout(function(){setMethod();},1000)
      });
    }else if(href.indexOf("/watchlater") > -1){
      // Watch later list, opened from Favorites.
      GM_addStyle(watchlaterStyle);
      setAllViewedMethod();
      setMethod = setWatchlaterPage;
      setPageScrollMethod();
    }else if(href.indexOf("/video/") > -1){
      // Video page
      GM_addStyle(videoStyle);
      setMethod = setVideoPage;
      setPageScrollMethod();
    }else if(href.indexOf("/festival/") > -1){
      // Festival player
      GM_addStyle(festivalVideoStyle);
      setMethod = setFestivalVideoPage;
      setPageScrollMethod();
    }else if(href.indexOf("/popular/") > -1){
      // Popular, weekly picks, must-watch, ranking, and the music chart
      GM_addStyle(popularStyle);
      setMethod = setPopularPage;
      $(".nav-tabs__item").click(function(e){
        setTimeout(function(){setMethod();},3000)
      })
      // Popular loads more as the page scrolls.
      setPageScrollMethod();
    }else if(href.indexOf("/history") > -1 ){
      // History
      GM_addStyle(historyStyle);
      setAllViewedMethod();
      setMethod = setHistoryPage;
      setPageScrollMethod();
    }else if(href.indexOf("/v/channel/") > -1 ){
      // Channel
      GM_addStyle(channelStyle);
      setMethod = setChannelPage;
      setTimeout(function(e){
        $(".discovery-panel__title").click(function(e){
          setTimeout(setMethod,2000);
        })
        $(".content-item").click(function(e){
          setTimeout(setMethod,4000);
        })
        $(".subscribe-item").click(function(e){
          setTimeout(setMethod,4000);
        })
      },2000);
    }else if(href.indexOf("/variety/") > -1 || href.indexOf("/movie/") > -1 || href.indexOf("/tv/") > -1 || href.indexOf("/documentary/") > -1){
      // Variety, movie, TV, and documentary sections
      GM_addStyle(varietyStyle);
      setMethod = setVarietyPage;
      setPageScrollMethod();
    }else if(href.endsWith(".com/") || href.indexOf(".com/?") > -1 || href.indexOf(".com/index.html") > -1){
      // Home
      GM_addStyle(indexStyle);
      setMethod = setIndexPage;
      setPageScrollMethod();
      setTimeout(function(){
        $(".feed-roll-btn").click(function(e){
          setTimeout(setMethod,2000);
        })
        $(".flexible-roll-btn").unbind("click").click(function(){
          setTimeout(setMethod,2000);
        })
      },2000);
    }else{
      // Other section homes: kichiku, dance, entertainment, tech, food, games, music, film, knowledge, news, and more.
      GM_addStyle(areaStyle);
      setMethod = setAreaPage;
      setPageScrollMethod();
      $(".channel-nav-sub-item").click(function(e){
        setTimeout(function(){setMethod();},1000)
      })
    }
  }
  btnRefresh.click(function(){
    setPageRefreshMethod();
  })
  // Check every 3 seconds, up to 5 times.
  if(setMethod != null){
    timer = setInterval(checkBtnViewLoad,3000);
  }
});

var preScrollTop = 0;// Previous offset of a nested scroller.
var pageHeight = 600; // Refresh after the page moves by two-thirds of the viewport.
var curPageScrollTop = 0; // Current page scroll offset.
var prePageScrollTop = 0; // Previous page scroll offset.
var setPageScrollMethod = function(){
  $(window).scroll(function(){
    var curPageScrollTop = $(document).scrollTop();
    if(Math.abs(curPageScrollTop - prePageScrollTop) > pageHeight){
      prePageScrollTop = curPageScrollTop;
      setTimeout(setMethod,1000);
    }
  })
}

var setPageRefreshMethod = function(){
  $(".btnView").remove();
  viewVideoMap = {};
  setMethod();
  setTimeout(function(e){
    setMethod();
  },3000);
}

const setAllViewedMethod = function(){
  btnSetAllViewed = $("<a class='btnSetAllViewed' title='一键设置未看视频为已看。只针对当前页面已加载出来的视频（带未看按钮的）。可以拉到页面底部加载出更多的视频再点这个。执行该操作后不可进行撤销，可根据个人情况进行使用。'>一键已看</a>")
  btnSetAllViewed.click(function(){
    if(!confirm($(this).attr("title"))){
        return;
    }
    $(".btnNotView").each(function(idx){
        saveGMVideoList($(this).data("av"),true);
    });
    setPageRefreshMethod();
  })
}

// Course player
var setCheesePlayPage = function(){
  var refreshObj = $(".btnRefresh");
  if(refreshObj.size() == 0){
    $(".layout-r").append("<a class='btnRefresh' title='如果列表没出现已看/未看标识，请手动点击这个按钮进行刷新'>刷新↗</a>");
    $(".btnRefresh").click(function(){
      setPageRefreshMethod();
    })
  }
  var indexJson = document.getElementById("app")._vnode.appContext.config.globalProperties.$pinia.state._rawValue.index;
  if(indexJson == null){
    return;
  }
  setVideoIsViewed($(".archive-tool-box"),".layout-l",0,"ep"+indexJson.currentEp.id,true);
  // Course outline
  var epoArr = indexJson.epList;
  $(".section-item").each(function(idx){
    setVideoIsViewed($(this),".season-info",0,"ep"+epoArr[idx].id,true,true);
  })
  // Related videos
  var rEpoArr = indexJson.viewInfo.recommend_seasons;
  $(".season-recommend-card").each(function(idx){
    setVideoIsViewed($(this),coverItemClass,0,"ss"+rEpoArr[idx].id);
  })
  $(".section-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,5000);
  })
  setBtnView();
}

// Course home
var setCheesePage = function(){
  // Cards
  $(".block-list-item").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Ranking cards
  $(".rank dd").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Category search, large cards
  $(".big-card").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Category search, small cards
  $(".small-card").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  $(".radio-button-box .item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".mode-trigger span").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".page-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(document).unbind('keyup').keyup(function(event){
    if(event.keyCode ==13){
      setTimeout(setPageRefreshMethod,2000);
    }
  });
  setBtnView();
}

// Chinese animation section
var setGuochuangPage = function(){
  // Scrolling recommendations
  $(".progress-bar-content").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Landscape covers
  $(".horizontal-ratio-item-inner").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Season calendar
  $(".timeline-weekday-hover-item").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Trending Chinese animation
  $(".ranking-ratio-item-container").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // New and hot
  $(".item-wrap").each(function(idx){
    var epid = $(this).children("a")[0].__vue__.$parent.item.episode_id;
    setVideoIsViewed($(this),coverItemClass,0,"ep"+epid,false,false);
  });
  // Subsection: latest and ordinary cards
  $(".spread-module").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Subsection: popular cards
  $(".rank-item").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  $(".tabs-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,3000);
  })
  $(".week-day-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,1000);
  })
  $(".next-page").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,1000);
  })
  $(".prev-page").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,1000);
  })
  // Index results
  $(".bangumi-item").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  $(".sort-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".filter-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".tag-item").unbind("click").click(function(e){
    setTimeout(setMethod,1000);
  })
  $(".read-push").unbind("click").click(function(e){
    setTimeout(setMethod,1000);
  })
  $(".tab-list li").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".dropdown-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".page-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(document).unbind('keyup').keyup(function(event){
    if(event.keyCode ==13){
      setTimeout(setPageRefreshMethod,1000);
    }
  });
  setBtnView();
}

// New-song chart
var setMusicplusPage = function(){
  // The lead card and the six beside it
  $(".video-card-reco").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Popular recommendations
  $(".card-pic").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  $(".tabs a").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,1000);
  })
  $(".more").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,1000);
  })
  $(".type-group li").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,1000);
  })
  $(".main-menu a").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,1000);
  })
  $(".pager a").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,1000);
  })
  $(document).unbind('keyup').keyup(function(event){
    if(event.keyCode ==13){
      setTimeout(setPageRefreshMethod,1000);
    }
  });
  setBtnView();
}

// Bangumi player
var setBangumiPage = function(){
  var linkArr = $("link");
  var linkRel = "";
  var linkHref = "";
  for(var i = 0 ; i < linkArr.length ;i++){
    linkRel = $(linkArr[i]).attr("rel");
    if(linkRel != "canonical"){
      continue;
    }
    linkHref = $(linkArr[i]).attr("href");
    if($(".toolbar").length > 0){
      setVideoIsViewed($(".player-left-components"),".toolbar",2,linkHref,true);
    }else{
      setVideoIsViewed($(".player-left-components"),".toolbar_toolbar__NJCNy",2,linkHref,true);
    }
    break;
  }
  var refreshObj = $(".btnRefresh");
  if(refreshObj.size() == 0){
    if($(".toolbar").length > 0){
      $(".toolbar").append("<a class='btnRefresh' title='如果列表没出现已看/未看标识，请手动点击这个按钮进行刷新'>刷新→</a>");
    }else{
      $(".toolbar_toolbar__NJCNy").append("<a class='btnRefresh' title='如果列表没出现已看/未看标识，请手动点击这个按钮进行刷新'>刷新→</a>");
    }

    $(".btnRefresh").click(function(){
      setPageRefreshMethod();
    })
  }
  if($(".toolbar").length > 0){
  }else{
    // Episodes, list layout
    $(".longListItem_wrap__9OsZi").each(function(){
      var pArr = Object.getOwnPropertyNames(this);
      if(pArr.length == 0){
        return;
      }
      var epId = eval("this."+pArr[0]+".return.key");
      setVideoIsViewed($(this),".longListItem_title__Xziqq",0,"ep"+epId,true,true);
      $(this).children("a:eq(1)").unbind("click").click(function(e){
        setTimeout(setPageRefreshMethod,2000);
      })
    })
    // Episodes, grid layout
    $(".numberListItem_number_list_item__wszA4").each(function(){
      setVideoIsViewed($(this),"a",0,null,true,true);
      $(this).children("a:eq(1)").unbind("click").click(function(e){
        setTimeout(setPageRefreshMethod,2000);
      })
    })
    $(".modeChangeBtn_wrap__NOGS3").unbind("click").click(function(e){
      setTimeout(setPageRefreshMethod,1000);
    })
    // Series
    $(".seasonlist_ss_item__czhHy").each(function(){
      setVideoIsViewed($(this),coverItemClass);
    })
    $(".seasonlist_expand_more__VcTha").unbind("click").click(function(e){
      setTimeout(setPageRefreshMethod,2000);
    })
    // PVs and extras
    $(".epitem_ep_item__CPdZy").each(function(){
      setVideoIsViewed($(this),"a",0,null,true,true);
      $(this).children("a:eq(1)").unbind("click").click(function(e){
        setTimeout(setPageRefreshMethod,2000);
      })
    })
    // Related videos
    $(".RecommendItem_wrap__pJmXL").each(function(){
      setVideoIsViewed($(this),coverItemClass);
      $(this).children("a:first").unbind("click").click(function(e){
        setTimeout(setPageRefreshMethod,3000);
      })
      // Playback can end without a recommendation list.
    })
  }
  setBtnView();
}

// Channel
var setChannelPage = function(){
  // Cards
  $(".video-card__content").each(function(){
    setVideoIsViewed($(this),coverItemClass,0,null,false,false,false,true); // Skip the rank 1/2/3 badge image.
  });
  $(".go-channel-btn").unbind("click").click(function(e){
    setTimeout(setMethod,2000);
  })
  // The right-hand list has its own scroller.
  $("#container").unbind("scroll").scroll(function(){
    var curScrollTop = $("#container").scrollTop();
    if(Math.abs(curScrollTop - preScrollTop) > pageHeight){
      preScrollTop = curScrollTop;
      setTimeout(setMethod,2000);
    }
  })
  $(".van-tabs-tab").unbind("click").click(function(e){
    setTimeout(setMethod,2000);
  })
  $(".year-selector__item").unbind("click").click(function(e){
    setTimeout(setMethod,2000);
  })
  $(".play-selector__item").unbind("click").click(function(e){
    setTimeout(setMethod,2000);
  })
  $(".relative-tags div a").unbind("click").click(function(e){
    setTimeout(setMethod,2000);
  })
  setBtnView();
}

// Variety, movie, TV, and documentary sections
var setVarietyPage = function(){
  // Top carousel
  $(".side-item").each(function(){
    setVideoIsViewed($(this),".title",0,null,false,false);
  });
  // Variety card, landscape cover
  $(".hot-item").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Variety card, portrait cover
  $(".hover-item").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Variety card, square cover. Wrap it so the button can be positioned.
  var itemDivArr = $(".column-itemDiv");
  if(itemDivArr.length == 0){
    var itemArr = $(".column-item");
    for(var i = 0 ; i < itemArr.length ;i++){
      var divObj = $("<div class='column-itemDiv'></div>");
      divObj.append(itemArr[i]);
      $(".module-column").append(divObj);
    }
  }
  // Square cover: .column-item is wrapped as .column-itemDiv.
  $(".column-itemDiv").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Index results
  $(".bangumi-item").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  $(".sort-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".filter-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,2000);
  })
  setBtnView();
}

// Other sections
var setAreaPage = function(){
  // Cards
  $(".bili-video-card__wrap").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Popular cards
  $(".bili-rank-list-video__item--wrap").each(function(){
    setVideoIsViewed($(this),".rank-video-card");
  });
  $(".roll-btn").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,3000);
  })
  // More, next to Refresh
  $(".tags-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,3000);
  })
  $(".channel-select-content-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,3000);
  })
  setBtnView();
}

var setPopularPage = function(){
  // Popular cards
  $(".video-card__content").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Ranking cards
  $(".img").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Music-chart cards
  $("._card_1kuml_6").each(function(){
    setVideoIsViewed($(this),coverItemClass,0,null,false,false,true,true);
  });
  // Short-drama cards. Wrap them so the button can be positioned.
  var itemListArr = $(".drama-board-listClone");
  if(itemListArr.length == 0){
    $(".drama-board-list").each(function(idx){
      var objOffset = $(this).offset();
      var cloneObj = $(this).clone();
      $(cloneObj).addClass("drama-board-listClone");
      $(cloneObj).addClass("drama-board-listClone_"+idx);
      $(cloneObj).removeClass("drama-board-list");
      $(this).parent().append(cloneObj);
      // Wrap each cloned card so the button can be positioned.
      var itemArr = $(".drama-board-listClone_"+idx+" .board-item-wrap");
      for(var i = 0; i < itemArr.length;i++){
        var divObj = $("<div class='board-item-wrapDiv'></div>");
        divObj.append(itemArr[i]);
        $(".drama-board-listClone_"+idx).append(divObj);
      }
      // Line the clone up with the original.
      $(cloneObj).offset(objOffset);
      $(this).attr("style","opacity:0;");
    })
  }
  $(".board-item-wrapDiv").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  })
  // Changing the weekly issue reloads the list.
  $(".panel .select-item").click(function(e){
    setTimeout(setPageRefreshMethod,5000);
  })
  $(".rank-tab li").click(function(e){
    $(".btnView").remove();
    setTimeout(setMethod,3000);
  })
  $(".periodShow").unbind("click").click(function(e){
    setTimeout(function(){
      $(".periodList .periodItem").unbind("click").click(function(e){
        $(".btnView").remove();
        setTimeout(setMethod,3000);

      })
    },500)
  })
  // Changing the short-drama issue removes the clone overlay.
  $(".dropdown-item").unbind("click").click(function(e){
    $(".drama-board-listClone").remove();
    $(".drama-board-list").removeAttr("style");
    setTimeout(setMethod,2000);
  })
  // Switching the short-drama tab removes the clone overlay.
  $(".switch-tabs .tab").unbind("click").click(function(e){
    var tabIndex = $(this).index();
    var objOffset = $(".drama-board-list:eq("+tabIndex+")").offset();
    $(".drama-board-listClone_"+tabIndex).offset(objOffset);
  })
  setBtnView();
}

var setIndexPage = function(){
  // Recommended cards
  $(".bili-video-card").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  setBtnView();
}

var setVideoPage = function(){
  var refreshObj = $(".btnRefresh");
  if(refreshObj.size() == 0){
    // Place Refresh to the right of the note button's more menu.
    $(".video-toolbar-right").append(btnRefresh);
    btnRefresh.text("刷新↗");
  }
  var initState = unsafeWindow.__INITIAL_STATE__;
  if(!initState){
    return;
  }
  // A multi-part video is stored as bvid-part.
  var bvid = initState.bvid;
  var videos = initState.videoData.videos; // Part count.
  if(videos > 1){
    bvid = bvid + "-"+initState.p;
  }
  if($(".video-info-meta").size() > 0){
    setVideoIsViewed($(".video-info-meta"),".pubdate-ip",0,bvid,true);
    // Overflow popup, when the info bar has one.
    setVideoIsViewed($(".overflow-panel"),".pubdate-ip",0,bvid,true);
  }else{
    // Detail-list layout.
    setVideoIsViewed($(".video-info-detail-list"),".pubdate-ip",0,bvid,true);
    // Overflow popup, when the info bar has one.
    setVideoIsViewed($(".overflow-panel"),".pubdate-ip",0,bvid,true);
  }

  // Subscribed collection
  $(".pod-item").each(function(){
      var targetObj = $(this).find(".cover:first");
      var bvNum = $(this).data("key");
      if(targetObj.length > 0){
        // With a cover.
        setVideoIsViewed(targetObj,coverItemClass,0,bvNum);
      }else{
        // Title only.
        setVideoIsViewed($(this),".title",0,bvNum,true,true);
      }
      // This item has a part list.
      var multiPObj = $(this).children(".multi-p");
      if(multiPObj.length > 0){
        multiPObj.children(".page-list").children(".page-item").each(function(idx){
          setVideoIsViewed($(this),".title",0,bvNum+"-"+(idx+1),true,true);
        });
      }
  })
  // Part list
  $(".multip .video-pod__item").each(function(idx){
      // Title only.
      setVideoIsViewed($(this),".title",0,initState.bvid+"-"+(idx+1),true,true);
  })
  // Part list, grid layout
  $(".multip.grid .page").each(function(idx){
      // Title only.
      if($(this).children("span").length == 0){
        $(this).append("<span></span>");
      }
      setVideoIsViewed($(this),"span",0,initState.bvid+"-"+(idx+1),true,true);
  })
  // Related videos
  $(".card-box .pic").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  })
  var relatedArr = initState.related;
  if(relatedArr && relatedArr.length > 0){
    // Recommendations shown in the player after playback ends
    $(".bpx-player-ending-related-itemDiv").each(function(idx){
      setVideoIsViewed($(this),".bpx-player-ending-related-item",0,relatedArr[idx].bvid,true,true); // The cover is a div.
      $(".bpx-player-ending-related-item").unbind("click").click(function(e){
        setTimeout(setPageRefreshMethod,3000);
      })
    });
    // Recommendations shown in the player after playback ends
    $(".bpx-player-video-wrap video").unbind("ended").bind("ended",function(e){
      setTimeout(function(){
        var itemDivArr = $(".bpx-player-ending-related-itemDiv");
        if(itemDivArr.length == 0){
          var itemArr = $(".bpx-player-ending-related-item");
          for(var i = 0 ; i < itemArr.length ;i++){
            var divObj = $("<div class='bpx-player-ending-related-itemDiv'></div>");
            divObj.append(itemArr[i]);
            $(".bpx-player-ending-related").append(divObj);
          }
        }
        $(".bpx-player-ending-related-itemDiv").each(function(idx){
          setVideoIsViewed($(this),".bpx-player-ending-related-item",0,relatedArr[idx].bvid,true,true); // The cover is a div.
          $(".bpx-player-ending-related-item").unbind("click").click(function(e){
            setTimeout(setPageRefreshMethod,3000);
          })
        });
      },2000);
    })
  }
  setBtnView();
  $(".video-pod__item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,3000);
  })
  $(".slide-item").unbind("click").click(function(e){
    setTimeout(setPageRefreshMethod,3000);
  })
  $(".view-mode").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".card-box").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".rec-footer").unbind("click").click(function(){
    setTimeout(setMethod,2000);
  })
}

var setFestivalVideoPage = function(){
  var refreshObj = $(".btnRefresh");
  if(refreshObj.size() == 0){
    // Place Refresh to the right of the note button's more menu.
    $(".video-toolbar-content_right").append("<a class='btnRefresh' title='如果列表没出现已看/未看标识，请手动点击这个按钮进行刷新'>刷新↗</a>");
    $(".btnRefresh").click(function(){
      setPageRefreshMethod();
    })
  }
  var initState = unsafeWindow.__INITIAL_STATE__;
  if(!initState){
    return;
  }
  var videoInfo = initState.videoInfo;
  if(videoInfo){
    var bvid = initState.videoInfo.bvid;
    setVideoIsViewed($(".video-toolbar-content"),".video-toolbar-content_left",0,bvid,true);
  }

  // Collection
  var sectionArr = initState.videoSections;
  if(sectionArr && sectionArr.length > 0){
    var epoArr = sectionArr[0].episodes;
    for(var i = 1 ; i < sectionArr.length;i++){
      epoArr = epoArr.concat(sectionArr[i].episodes);
    }
    $(".video-episode-card").each(function(idx){
      var targetObj = $(this).find(".video-episode-card__cover:first");
      if(targetObj.length > 0){
        // With a cover.
        setVideoIsViewed(targetObj,".activity-image-card__image",0,epoArr[idx].bvid);// The cover image is a div.
      }else{
        // Title only.
        setVideoIsViewed($(this),".video-episode-card__info-title",0,epoArr[idx].bvid,true,true);
      }
    })
    $(".video-episode-card").unbind("click").click(function(e){
      setTimeout(setPageRefreshMethod,3000);
    })
  }
  // Related videos
  var recommendArr = initState.recommendList.relate_video;
  if(recommendArr){
    $(".recommend-video-card").each(function(idx){
      setVideoIsViewed($(this),".activity-image-card__image",0,recommendArr[idx].bvid); // The cover image is a div.
    });
    // Playback can end without a recommendation list.
  }
  setBtnView();
}

var setHistoryPage = function(){
  var refreshObj = $(".btnRefresh");
  if(refreshObj.size() == 0){
    // History toolbar.
    $(".breadcrumbs__top .right").prepend(btnRefresh);
    $(".breadcrumbs__top .right").prepend(btnSetAllViewed);
  }
  // Video cards
  $(".bili-video-card__cover").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  setBtnView();
  $(document).unbind('keyup').keyup(function(event){
    if(event.keyCode ==13){
      setTimeout(setPageRefreshMethod,2000);
    }
  });
  $(".radio-filter__item").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".lists-view-mode").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".search-btn").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".batch-manage-btn").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
}

// Watch later player
var setListPlayPage = function(){
  var refreshObj = $(".btnRefresh");
  if(refreshObj.size() == 0){
    // Place Refresh to the right of the note button's more menu.
    $(".video-toolbar-right").append(btnRefresh);
    btnRefresh.text("刷新↗");
  }
  var initState = unsafeWindow.__INITIAL_STATE__;
  if(!initState){
    return;
  }
  // A multi-part video is stored as bvid-part.
  var bvid = initState.bvid;
  var videos = initState.videoData.videos; // Part count.
  if(videos > 1){
    bvid = bvid + "-"+initState.p;
  }
  setVideoIsViewed($(".video-info-meta"),".pubdate-ip",0,bvid,true);
  // Overflow popup, when the info bar has one.
  setVideoIsViewed($(".overflow-panel"),".pubdate-ip",0,bvid,true);

  // Watch later queue
  var epoArr = initState.resourceList;
  let eachBvid = null;
  let listClass = ".actionlist-item-inner" ; // Old item class. Some pages still use it.
  if($(listClass).length == 0){
    listClass = ".action-list-item-wrap"; // Current item class.
  }
  $(listClass+" .main").each(function(idx){
    if(typeof epoArr[idx].bv_id == "undefined"){
      // Current pages send bvid.
      eachBvid = epoArr[idx].bvid;
    }else{
      // Older pages still send bv_id.
      eachBvid = epoArr[idx].bv_id;
    }
    setVideoIsViewed($(this),coverItemClass,0,eachBvid);
    var multipObj = $(this).parent().children(".multip-list:first");
    if(multipObj.length > 0){
      // This item has a part list.
      $(multipObj[0]).children(".multip-list-item").each(function(idx2){
        if(epoArr[idx].pages[idx2].p){
          // Current part index is p.
          setVideoIsViewed($(this),".left-part",0,eachBvid+"-"+epoArr[idx].pages[idx2].p,true);
        }else{
          // Older pages still send page.
          setVideoIsViewed($(this),".left-part",0,eachBvid+"-"+epoArr[idx].pages[idx2].page,true);
        }
        $(this).unbind("click").click(function(){
          setTimeout(setPageRefreshMethod,2000);
        })
      })
    }
    $(this).unbind("click").click(function(){
      setTimeout(setPageRefreshMethod,2000);
    })
  })
  // Related videos
  $(".pic-box").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  $(".del-btn").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  setBtnView();
}

const setWatchlaterPage = function(){
  let refreshObj = $(".btnRefresh");
  if(refreshObj.size() == 0){
    $(".list-header-options").prepend(btnRefresh);
    $(".list-header-options").prepend(btnSetAllViewed);
  }
  // Video cards
  $(".bili-video-card__cover").each(function(){
    setVideoIsViewed($(this),coverItemClass,3);
  });
  setBtnView();
  $(document).unbind('keyup').keyup(function(event){
    if(event.keyCode ==13){
      setTimeout(setPageRefreshMethod,2000);
    }
  });
  $(".list-header-filter__btn").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".watchlater-list-title-sort").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".search-btn").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".menu-popover__panel-item").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".action-btn").unbind("click").click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
}

const setSpacePage = function(){
  let refreshObj = $(".btnRefresh");
  if(refreshObj.size() == 0){
    // Current space header.
    $(".nav-bar__main-left").append(btnRefresh);
    // Old space header.
    $(".n-inner").append(btnRefresh);
  }
  // Pinned video
  $(".i-pin-part .i-pin-has-content").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });

  // Space home cards: picks, the pin, their videos, recent coins, collections, and recent likes.
  // Uploads
  // Cards, grid layout
  $(".small-item").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Current space header.
  $(".bili-video-card__cover").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });

  // Dynamics
  // Logged-in dynamics: https://t.bilibili.com/
  // Space dynamics: https://space.bilibili.com/xxxx/dynamic
  $(".bili-dyn-content__orig__major").each(function(){
    var coverObj = $(this).find(".bili-awesome-img:first");// Current layout uses a div cover.
    if(coverObj.length > 0){
      setVideoIsViewed($(this),".bili-awesome-img");
    }else{
      setVideoIsViewed($(this),coverItemClass);// The old layout and t.bilibili use an img cover.
    }
  });
  // Cards, list layout
  $(".list-item").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Collection detail after More
  $(".video-card").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  setBtnView();
  $(".bili-dyn-up-list__item").unbind("click").click(function(){
    prePageScrollTop = 0;
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".be-pager li").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".search-btn").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(document).unbind('keyup').keyup(function(event){
    if(event.keyCode ==13){
      setTimeout(setPageRefreshMethod,2000);
    }
  });
  $(".n-tab-links a").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".contribution-item").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".be-tab-item").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $("#submit-video-type-filter a").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".fav-item a").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".more").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".more-btn").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".list-style span").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".nav-tab__item").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".radio-filter__item").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".vui_button").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".side-nav__item").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".lists-view-mode").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".back").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".menu-popover__panel-item").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".fav-sidebar-item").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
}

var coverItemClass = "img";
var setBtnView = function(){
  $(".btnView").unbind("click").click(function(e){
    var avId = $(this).data("av");
    var view = $(this).data("view");
    // Read the saved state before writing. The same id can show up on more than one card.
    // Skip the play icon on course covers.
    // Skip the disc image on the music ranking.
    var coverObjs = $(this).parent().find(coverItemClass+":not(.block-list-item-info-player--img):not(.cover):first");
    var setIsViewed = false;
    if(view == 0){
      setIsViewed = true;
      $(this).text("已看");
      $(this).removeClass("btnNotView");
      $(this).addClass("btnIsView");
      $(this).data("view","1");
      coverObjs.css("opacity",opacityIsViewCover);
    }else{
      $(this).text("未看");
      $(this).removeClass("btnIsView");
      $(this).addClass("btnNotView");
      $(this).data("view","0");
      coverObjs.css("opacity","1");
    }
    $(".btnView").remove();
    saveGMVideoList(avId,setIsViewed);
    setMethod();
    return false;
  });
}

// Shared by every page. Stop once a button is present, and give up after 8 checks.
var isCheck = true;
var btnCount = 0;
var checkCount = 0;
var checkBtnViewLoad = function(){
  if(!isCheck){
    clearInterval(timer);
    timer = null;
    return;
  }
  btnCount = $(".btnView").size();
  if(btnCount > 0 || checkCount > 5){
    clearInterval(timer);
    timer = null;
  }else{
    setMethod();
  }
  checkCount++;
}

var isView = 0;

var videoArr = null;
var isTextAreaHidden = true;
var setSearchPage = function(){
  var refreshObj = $(".btnRefresh");
  if(refreshObj.size() == 0){
    $(".vui_tabs--navbar").append("<a class='btnList' title='显示/隐藏已看ID的数据列表，建议定期复制到其他地方进行保存，避免因事故造成丢失'>显示/隐藏</a>");
    $(".vui_tabs--navbar").append("<a class='btnListSave' title='如果文本框内容有修改，请点击这个按钮进行保存。'>保存列表</a>");
    $(".vui_tabs--navbar").append("<textarea class='viewList'></textarea>");
    $(".search-input-container .flex_center").append(btnRefresh);
    $(".btnList").click(function(){
      if(isTextAreaHidden){
        var keyList = GM_listValues();
        var key = "";
        var str = "";
        for(var i = 0 ; i < keyList.length;i++){
          key = keyList[i];
          if(key.indexOf("BiliViewed_") == 0){
            str += GM_getValue(key,"")+",";
          }
        }
        $(".viewList").val(str);
      }
      isTextAreaHidden = !isTextAreaHidden;
      $(".viewList").toggle();
      $(".btnListSave").toggle();
    })
    $(".btnRefresh").click(function(){
      setPageRefreshMethod();
    })
    $(".btnListSave").click(function(){
      viewVideoList = $(".viewList").val();
      saveTextAreaVideoList(viewVideoList);
      isTextAreaHidden = !isTextAreaHidden;
      $(".viewList").toggle();
      $(".btnListSave").toggle();
    })
  }
  // Bangumi search results
  // Bangumi cover
  $(".media-card").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  // Bangumi episode list
  var itemSpanArr = $(".media-footerClone .p_relativeSpan");
  if(itemSpanArr.length == 0){
    // Clone .media-footer. The original row cannot hold the button.
    $(".media-card-content-footer").each(function(idx){
      var mFooter = $(this).find(".media-footer:first");
      if(mFooter.length == 0){
        return;
      }
      var objOffset = mFooter.offset();
      var cloneObj = $(mFooter).clone();
      $(cloneObj).addClass("media-footerClone");
      $(cloneObj).addClass("media-footerClone_"+idx);
      $(cloneObj).removeClass("media-footer");
      $(this).append(cloneObj);
      // Wrap each cloned card so the button can be positioned.
      var itemArr = $(".media-footerClone_"+idx+" .p_relative");
      for(var i = 0 ; i < itemArr.length ;i++){
        var spanObj = $("<span class='p_relativeSpan'></span>");
        spanObj.append(itemArr[i]);
        $(".media-footerClone_"+idx).append(spanObj);
      }
      // Line the clone up with the original.
      $(".media-footerClone_"+idx).offset(objOffset);
    })
    $(".media-footer").attr("style","opacity:0");// Hide the original layer.
    // A resize invalidates the clone's position, so drop it and rebuild.
    $(window).unbind("resize").resize(function(){
      $(".media-footer").removeAttr("style");
      $(".media-footerClone").remove();
      setTimeout(setMethod,2000);
    })
  }
  $(".p_relativeSpan").each(function(){
    setVideoIsViewed($(this),".vui_button");
  });
  // Variety search results
  // Variety episode list
  $(".seleced-ep").unbind("mouseenter").bind("mouseenter",function(){
    setTimeout(setMethod,500);
  })
  var itemArr = $(".media-footer-select-content-item");
  itemSpanArr = $(".selConSpan");
  var newLength = itemArr.length - itemSpanArr.length;
  if(itemSpanArr.length == 0 || newLength > 0){
    for(var i = itemSpanArr.length ; i < itemArr.length ;i++){
      var spanObj = $("<div class='selConSpan'></div>");
      spanObj.append(itemArr[i]);
      $(".media-footer-select-content").append(spanObj);
    }
  }
  $(".selConSpan").each(function(){
    setVideoIsViewed($(this),".media-footer-select-content-item",0,null,true,true);
  });
  // Keep Show More at the end of the list after episodes are wrapped.
  $(".media-footer-select-content-more").each(function(){
    $(this).appendTo($(this).parent());
  })
  // Uploader videos and ordinary results
  $(".bili-video-card__wrap").each(function(){
    setVideoIsViewed($(this),coverItemClass);
  });
  setBtnView();
  $(document).unbind('keyup').keyup(function(event){
    if(event.keyCode ==13){
      setTimeout(setPageRefreshMethod,2000);
    }
  });
  $(".vui_tabs--nav-item").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
  $(".vui_button").unbind('click').click(function(){
    setTimeout(setPageRefreshMethod,2000);
  })
}

// Returns the id with the leading BV removed, or null when the card cannot be marked.
// targetAppend: element that contains the link and receives the button.
// coverClass: cover element whose opacity shows the watched state.
// playType: 0 normal or bangumi, 1 old watch-later path, 2 bangumi id passed in, 3 watch-later list URL.
// videoid: use this id instead of reading a link from targetAppend.
// noAppendTarget: put the button on the cover and leave the cover opacity unchanged. Used on the player page.
// isBefore: insert the button before the target instead of appending it inside.
// findALast: use the last link in targetAppend.
// findCoverClassLast: use the last cover match.
var bvid = null;
var setVideoIsViewed = function(targetAppend,coverClass,playType,videoid,noAppendTarget,isBefore,findALast,findCoverClassLast){
  var coverObj = null;
  if(findCoverClassLast){
    coverObj = targetAppend.find(coverClass+":last");
  }else{
    coverObj = targetAppend.find(coverClass+":first");
  }
  if(coverObj.length == 0){
    return null;
  }
  var btnView = null;
  if(noAppendTarget){
    if(isBefore){
      btnView = coverObj.parent().children(".btnView:first");
    }else{
      btnView = coverObj.children(".btnView:first");
    }
  }else{
    btnView = targetAppend.children(".btnView:first");
  }
  if(btnView.length > 0){
    return null;
  }
  if(videoid != null && playType != 2){
    bvid = videoid;
  }else{
    if(playType == 2){
      // playType 2 passes the page URL in videoid.
      bvid = videoid;
      playType = 0;
    }else{
      var aObj = null;
      if(findALast){
        aObj = targetAppend.find("a:last");
      }else{
        aObj = targetAppend.find("a:first");
      }
      if(aObj.length == 0){
        return null;
      }
      bvid = aObj.attr("href");
    }
    if(bvid == null){
      return null;
    }
    if(playType == 1){
      // Old watch-later path.
      bvid = bvid.replace("//www.bilibili.com/medialist/play/watchlater/","");
    }else if(playType == 3){
      // Watch later list: /list/watchlater?bvid=BVxxxxxxx&oid=xxxxxxx
      bvid = getBvidFromUrl(bvid);
      if(!bvid){
        return;
      }
    }else{
      // Short link.
      bvid = bvid.replace("//b23.tv/","");
      // Course card on the home page.
      bvid = bvid.replace("//m.bilibili.com/cheese/play/","");
      // Ordinary video.
      bvid = bvid.replace("//www.bilibili.com/video/","").replace("/video/","");
      // Bangumi.
      bvid = bvid.replace("//www.bilibili.com/bangumi/play/","").replace("/bangumi/play/","");
      // Course.
      bvid = bvid.replace("//www.bilibili.com/cheese/play/","").replace("/cheese/play/","");
    }
    bvid = bvid.replace("https:","");
    var slashIndex = bvid.indexOf("/");
    if(slashIndex > -1){
      bvid = bvid.substring(0,slashIndex);
    }
    if(bvid.length == 0){
      return null;
    }
    slashIndex = bvid.indexOf("?");
    if(slashIndex > -1){
      bvid = bvid.substring(0,slashIndex);
    }
    bvid = bvid.replace("/","");
  }
  if(bvid.startsWith("av")){
    // av id to BV.
    bvid = bvid.substr(2);
    bvid = avToBv.encode(bvid);
    bvid = bvid.substr(2);
  }else if(bvid.startsWith("BV") || bvid.startsWith("bv")){
    bvid = bvid.substr(2);
  }else if(bvid.startsWith("ep") || bvid.startsWith("ss")){
    // Bangumi ep/ss ids are stored as they are.
  }else{
    return null;
  }
  if(noAppendTarget){
    targetAppend = coverObj;
  }
  if(getBvIsViewed(bvid)){
    if(isBefore){
      targetAppend.before("<a class='btnView btnIsView' data-view='1' data-av='"+bvid+"'>已看</a>");
    }else{
      targetAppend.append("<a class='btnView btnIsView' data-view='1' data-av='"+bvid+"'>已看</a>");
    }
    if(!noAppendTarget){
      coverObj.css("opacity",opacityIsViewCover);
    }
  }else{
    if(isBefore){
      targetAppend.before("<a class='btnView btnNotView' data-view='0' data-av='"+bvid+"'>未看</a>");
    }else{
      targetAppend.append("<a class='btnView btnNotView' data-view='0' data-av='"+bvid+"'>未看</a>");
    }
    if(!noAppendTarget){
      coverObj.css("opacity","1");
    }
  }
  return bvid;
}

var getBvidFromUrl = function(url) {
    const regex = /bvid=([^&]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Storage is split into small groups so one GM entry does not hold every id.
var getGroupId = function(bvid) {
  bvid = bvid + "";
  if (bvid.length < 5) { // Shortest id is ss100.
    return null;
  }

  if (bvid.startsWith("ep")) {
    // Bangumi episode: ep plus its last digit.
    return "ep" + bvid.slice(-1);
  } else if (bvid.startsWith("ss")) {
    // Bangumi season: ss plus its last digit.
    return "ss" + bvid.slice(-1);
  } else if (bvid.length === 10) {
    // BV id: second character.
    return bvid.substr(1, 1);
  } else if (bvid.length > 10 && bvid.indexOf("-") === 10) {
    // Multi-part id (bv-N): second character.
    return bvid.substr(1, 1);
  }

  return null;
};

var viewVideoMap = {};
var getBvIsViewed = function(bvid){
  const groupId = getGroupId(bvid);
  if (!groupId) {
    return false;
  }
  if(!viewVideoMap[groupId]){
    const storedData = GM_getValue("BiliViewed_" + groupId, null);
    viewVideoMap[groupId] = storedData ? new Set(storedData) : new Set();
  }
  return viewVideoMap[groupId].has(bvid);
}

var saveGMVideoList = function(bvid,isViewed){
  const groupId = getGroupId(bvid);
  if (!groupId) {
    return false;
  }
  if (!viewVideoMap[groupId]) {
    const storedData = GM_getValue("BiliViewed_" + groupId, null);
    viewVideoMap[groupId] = storedData ? new Set(storedData) : new Set();
  }
  const videoSet = viewVideoMap[groupId];

  if(isViewed){
    videoSet.add(bvid);
  }else{
    videoSet.delete(bvid);
  }
  // GM storage can hold an array, not a Set.
  const videoArr = Array.from(videoSet);
  GM_setValue("BiliViewed_" + groupId, videoArr);
  return true;
}

// Group the pasted ids with the same key getGroupId uses.
var saveTextAreaVideoList = function(viewVideoList){
  // An empty list clears every saved id.
  if (!viewVideoList || viewVideoList.trim() === "") {
    clearAllBiliViewedData();
    return;
  }

  // Commas and newlines are both separators.
  var videoArr = viewVideoList.replaceAll("\n", ",").split(",");
  var groupMap = {};

  for (var bvid of videoArr) {
    bvid = bvid.trim();
    if (bvid.length < 6) {
      continue;
    }

    var gid = getGroupId(bvid);
    if (!gid) {
      continue;
    }

    if (!groupMap[gid]) {
      groupMap[gid] = new Set();
    }
    groupMap[gid].add(bvid);
  }

  clearAllBiliViewedData();

  for (var key in groupMap) {
    var storedIds = Array.from(groupMap[key]);
    GM_setValue("BiliViewed_" + key, storedIds);
  }

  updateViewVideoMap(groupMap);
}

var clearAllBiliViewedData = function() {
  var keyList = GM_listValues();
  for (var key of keyList) {
    if (key.indexOf("BiliViewed_") === 0) {
      GM_deleteValue(key);
    }
  }
  viewVideoMap = {};
};

var updateViewVideoMap = function(groupMap) {
  viewVideoMap = {};
  for (var key in groupMap) {
    viewVideoMap[key] = new Set(groupMap[key]);
  }
};

// AV to BV. https://github.com/Coxxs/bvid/blob/master/bvid.js
var avToBv = (function () {
  var table = 'fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF'
  var tr = {}
  for (var i = 0; i < 58; i++) {
    tr[table[i]] = i
  }
  var s = [11, 10, 3, 8, 4, 6]
  var r = ['B', 'V', '1', '', '', '4', '', '1', '', '7', '', '']
  var xor = 177451812
  var add = 8728348608

 function encode(x) {
    if (x <= 0 || x >= 1e9) {
      return null
    }
    x = (x ^ xor) + add
    var result = r.slice()
    for (var i = 0; i < 6; i++) {
      result[s[i]] = table[Math.floor(x / 58 ** i) % 58]
    }
    return result.join('')
  }
  return { encode }
})()
