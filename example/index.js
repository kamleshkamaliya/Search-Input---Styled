  var PREFIX = "hubspot-search-styled"; 
  
  // -- CONFIG HELPER --
  var getConfig = function() {
      // Safety check for elements to prevent errors if DOM isn't ready
      var domainEl = document.getElementById('conf-domain');
      var pageModeEl = document.getElementById('conf-pagination-mode');
      var gridLimitEl = document.getElementById('conf-grid-limit');
      var dropLimitEl = document.getElementById('conf-typeahead-limit');
      var autoScrollEl = document.getElementById('conf-auto-scroll');

      return {
          domain: domainEl ? domainEl.value.trim() : 'www.hubspot.com',
          paginationMode: pageModeEl ? pageModeEl.value : 'loadMore',
          gridLimit: gridLimitEl ? (parseInt(gridLimitEl.value) || 6) : 6,
          dropdownLimit: dropLimitEl ? (parseInt(dropLimitEl.value) || 3) : 3,
          autoScroll: autoScrollEl ? autoScrollEl.checked : true
      };
  };

  var hsSearch = function (_instance) {
    var searchTerm = '';
    var searchForm = _instance;
    var searchField = _instance.querySelector('.' + PREFIX + '-input');
    var searchResults = _instance.querySelector('.' + PREFIX + '-suggestions');
    var resultsArea = document.querySelector('.' + PREFIX + '-results-area');
    var resultsSection = document.getElementById('results-section'); 
    
    var activeMode = 'dropdown'; 
    var currentOffset = 0; 
    var totalResults = 0;

    const addTypeParamsFromUrl = function (formParams) {
        return formParams; 
    };

    const searchOptions = function () {
      let formParams = [];
      const form = _instance.querySelector('form');
      for (let i = 0; i < form.querySelectorAll('input[type=hidden]').length; i++) {
        const e = form.querySelectorAll('input[type=hidden]')[i];
        if (e.name !== 'limit') {
          formParams.push(encodeURIComponent(e.name) + '=' + encodeURIComponent(e.value));
        }
      }
      return formParams.join('&');
    };

    var debounce = function (func, wait, immediate) {
      var timeout;
      return function () {
        var context = this, args = arguments;
        var later = function () {
          timeout = null;
          if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait || 200);
        if (callNow) func.apply(context, args);
      };
    };

    var emptySearchResults = function () {
      searchResults.innerHTML = '';
      searchForm.classList.remove(PREFIX + '-open');
      if(activeMode === 'dropdown') {
          currentOffset = 0;
          totalResults = 0;
      }
    };

    var stripHtml = function(html) {
       if (!html) return "";
       var tmp = document.createElement("DIV");
       tmp.innerHTML = html;
       return tmp.textContent || tmp.innerText || "";
    };

    var createResultItem = function(val, globalIndex) {
        var imgHtml = '';
        if (val.featuredImageUrl) {
            imgHtml = "<div class='" + PREFIX + "-img'><img src='" + val.featuredImageUrl + "' alt='" + stripHtml(val.title) + "'></div>";
        }
        var descHtml = val.description ? "<p class='" + PREFIX + "-desc'>" + (stripHtml(val.description).substring(0, 60) + "...") + "</p>" : "";

        return "<li class='" + PREFIX + "-item' id='" + PREFIX + "-result-" + globalIndex + "'>" +
               "<a href='" + val.url + "'>" + imgHtml +
                  "<div class='" + PREFIX + "-content'>" +
                      "<span class='" + PREFIX + "-title'>" + val.title + "</span>" +
                      descHtml +
                  "</div>" +
               "</a></li>";
    };

    var createGridCard = function(val, globalIndex) {
        var imgHtml = val.featuredImageUrl 
            ? "<div class='" + PREFIX + "-card-img'><img src='" + val.featuredImageUrl + "' alt='" + stripHtml(val.title) + "'></div>" 
            : "<div class='" + PREFIX + "-card-img' style='background:#f1f5f9; display:flex; align-items:center; justify-content:center;'><span style='color:#cbd6e2; font-size:3rem;'><i class='fas fa-image'></i></span></div>";

        var descHtml = val.description 
            ? "<p class='" + PREFIX + "-card-desc'>" + stripHtml(val.description) + "</p>" 
            : "";

        return "<a href='" + val.url + "' class='" + PREFIX + "-card' id='" + PREFIX + "-card-" + globalIndex + "'>" +
                 imgHtml +
                 "<div class='" + PREFIX + "-card-content'>" +
                    "<h3 class='" + PREFIX + "-card-title'>" + val.title + "</h3>" +
                    descHtml +
                    "<div class='" + PREFIX + "-card-cta'>Read More &rarr;</div>" +
                 "</div>" +
               "</a>";
    };

    var fillSearchResults = function (response, isAppend) {
      if (activeMode === 'dropdown') {
          fillDropdown(response, isAppend);
      } else {
          fillGrid(response, isAppend);
      }
    };

    var fillDropdown = function(response, isAppend) {
        var conf = getConfig();
        var items = [];
        if (!isAppend) items.push("<li class='" + PREFIX + "-header'>Results for \"" + response.searchTerm + '"</li>');
        
        response.results.forEach(function (val, index) {
            items.push(createResultItem(val, isAppend ? (currentOffset + index) : index));
        });

        var existingBtn = searchResults.querySelector('.' + PREFIX + '-load-more');
        if(existingBtn) existingBtn.remove();

        if (totalResults > (currentOffset + conf.dropdownLimit)) {
            items.push("<li class='" + PREFIX + "-load-more'>Load More (" + (totalResults - (currentOffset + conf.dropdownLimit)) + ")</li>");
        }

        if (isAppend) searchResults.insertAdjacentHTML('beforeend', items.join(''));
        else searchResults.innerHTML = items.join('');
        
        searchForm.classList.add(PREFIX + '-open');

        // --- NEW: AUTO SCROLL FOR DROPDOWN ---
        if (isAppend && conf.autoScroll) {
            var firstNewId = PREFIX + "-result-" + currentOffset;
            var firstNewElement = document.getElementById(firstNewId);
            
            if (firstNewElement) {
                setTimeout(function() {
                    // Scroll the container (UL), not the window
                    searchResults.scrollTo({
                        top: firstNewElement.offsetTop,
                        behavior: 'smooth'
                    });
                }, 100);
            }
        }
        // -------------------------------------

        var loadMoreBtn = searchResults.querySelector('.' + PREFIX + '-load-more');
        if(loadMoreBtn) {
            loadMoreBtn.addEventListener('click', function(e){
                e.stopPropagation(); e.preventDefault();
                currentOffset += conf.dropdownLimit;
                loadMoreBtn.innerHTML = "Loading...";
                getSearchResults(true);
            });
        }
    };

    var fillGrid = function(response, isAppend) {
        var conf = getConfig();
        if(resultsSection) resultsSection.classList.remove('hidden');

        var gridContainer = resultsArea.querySelector('.' + PREFIX + '-grid');
        
        if(!gridContainer || conf.paginationMode === 'pagination' || !isAppend) {
            resultsArea.innerHTML = '<h2 class="text-2xl font-bold text-slate-800 mb-6 border-b border-slate-200 pb-4">Search Results for: "<span class="text-primary">' + response.searchTerm + '</span>" <span class="text-sm font-normal text-slate-400 float-right">Total: '+totalResults+'</span></h2><div class="' + PREFIX + '-grid"></div>';
            gridContainer = resultsArea.querySelector('.' + PREFIX + '-grid');
        }

        var cards = [];
        response.results.forEach(function (val, index) {
             cards.push(createGridCard(val, isAppend ? (currentOffset + index) : index));
        });

        if(conf.paginationMode === 'loadMore' && isAppend) {
            gridContainer.insertAdjacentHTML('beforeend', cards.join(''));
        } else {
            gridContainer.innerHTML = cards.join('');
        }

        var oldBtn = resultsArea.querySelector('.' + PREFIX + '-grid-load-more');
        var oldPag = resultsArea.querySelector('.hubspot-search-pagination');
        if(oldBtn) oldBtn.remove();
        if(oldPag) oldPag.remove();

        if(conf.paginationMode === 'loadMore') {
            if (totalResults > (currentOffset + conf.gridLimit)) {
                 var btnHTML = "<button class='" + PREFIX + "-grid-load-more'>Load More Posts (" + (totalResults - (currentOffset + conf.gridLimit)) + " remaining)</button>";
                 resultsArea.insertAdjacentHTML('beforeend', btnHTML);
                 
                 var newBtn = resultsArea.querySelector('.' + PREFIX + '-grid-load-more');
                 newBtn.addEventListener('click', function() {
                     currentOffset += conf.gridLimit;
                     newBtn.innerHTML = "<i class='fas fa-spinner fa-spin mr-2'></i> Loading...";
                     newBtn.disabled = true;
                     getSearchResults(true);
                 });
            }
        } 
        else {
            var totalPages = Math.ceil(totalResults / conf.gridLimit);
            if(totalPages > 1) {
                var currentPage = Math.floor(currentOffset / conf.gridLimit) + 1;
                var paginationHTML = '<div class="hubspot-search-pagination">';
                
                paginationHTML += `<button class="hs-page-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}"><i class="fas fa-chevron-left"></i></button>`;
                
                for(var i = 1; i <= totalPages; i++) {
                    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                        paginationHTML += `<button class="hs-page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                    } else if (i === currentPage - 2 || i === currentPage + 2) {
                        paginationHTML += `<span class="px-2 text-slate-400">...</span>`;
                    }
                }

                paginationHTML += `<button class="hs-page-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}"><i class="fas fa-chevron-right"></i></button>`;
                paginationHTML += '</div>';
                resultsArea.insertAdjacentHTML('beforeend', paginationHTML);

                var pageBtns = resultsArea.querySelectorAll('.hs-page-btn');
                pageBtns.forEach(btn => {
                    btn.addEventListener('click', function() {
                        var targetPage = parseInt(this.getAttribute('data-page'));
                        if(targetPage && targetPage !== currentPage) {
                            currentOffset = (targetPage - 1) * conf.gridLimit;
                            resultsSection.scrollIntoView({behavior: 'smooth', block: 'start'});
                            getSearchResults(false);
                        }
                    });
                });
            }
        }

        // --- GRID AUTO SCROLL ---
        if (isAppend && conf.autoScroll && conf.paginationMode === 'loadMore') {
            var firstNewId = PREFIX + "-card-" + currentOffset;
            var el = document.getElementById(firstNewId);
            if(el) setTimeout(() => el.scrollIntoView({behavior: 'smooth', block: 'center'}), 100);
        }
        
        if (!isAppend && resultsSection) {
             setTimeout(() => resultsSection.scrollIntoView({behavior: 'smooth', block: 'start'}), 100);
        }
    };

    var getSearchResults = function (isAppend) {
      var request = new XMLHttpRequest();
      var conf = getConfig();
      
      var targetDomain = conf.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      var limit = (activeMode === 'dropdown') ? conf.dropdownLimit : conf.gridLimit;

      var requestUrl = 'https://' + targetDomain + '/_hcms/search?&term=' + encodeURIComponent(searchTerm) +
        '&limit=' + limit +
        '&offset=' + currentOffset + 
        '&autocomplete=true&analytics=true&' +
        searchOptions();

      request.open('GET', requestUrl, true);
      request.onload = function () {
        if (request.status >= 200 && request.status < 400) {
          var data = JSON.parse(request.responseText);
          if (data.total > 0) totalResults = data.total;
          
          if (data.results && data.results.length > 0) {
            fillSearchResults(data, isAppend);
          } else {
            if(!isAppend) {
                if(activeMode === 'dropdown') emptySearchResults();
                else {
                    if(resultsSection) resultsSection.classList.remove('hidden');
                    resultsArea.innerHTML = '<div class="text-center py-12"><div class="text-4xl text-slate-300 mb-4"><i class="fas fa-search"></i></div><h3 class="text-lg font-semibold text-slate-600">No results found for "' + searchTerm + '"</h3></div>';
                }
            }
          }
        } else {
             console.error('Error fetching results');
        }
      };
      request.onerror = function() { console.error('Network Error'); };
      request.send();
    };

    var isSearchTermPresent = debounce(function () {
      searchTerm = searchField.value;
      if (searchTerm.length > 2) {
        activeMode = 'dropdown'; 
        currentOffset = 0;
        getSearchResults(false); 
      } else if (searchTerm.length == 0) {
        emptySearchResults();
        if(resultsArea) resultsArea.innerHTML = '';
        if(resultsSection) resultsSection.classList.add('hidden');
      }
    }, 250);

    searchField.addEventListener('input', function (e) {
      if (searchTerm != searchField.value) isSearchTermPresent();
    });

    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      searchTerm = searchField.value;
      if(searchTerm.length > 0) {
          activeMode = 'full'; 
          currentOffset = 0;
          emptySearchResults(); 
          if(resultsSection) resultsSection.classList.remove('hidden');
          if(resultsArea) resultsArea.innerHTML = '<div class="hubspot-search-loader"><i class="fas fa-circle-notch fa-spin text-primary text-3xl mb-3"></i><br>Searching database...</div>';
          getSearchResults(false);
      }
    });
    
    document.addEventListener('click', function(e) {
        if (!_instance.contains(e.target)) {
             if (e.target.closest('.hubspot-search-styled-config-panel')) return;
             searchResults.innerHTML = '';
             searchForm.classList.remove(PREFIX + '-open');
        }
    });
  };

  if (document.attachEvent ? document.readyState === 'complete' : document.readyState !== 'loading') {
    var modules = document.querySelectorAll('.' + PREFIX + '-field');
    Array.prototype.forEach.call(modules, function (el) { hsSearch(el); });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      var modules = document.querySelectorAll('.' + PREFIX + '-field');
      Array.prototype.forEach.call(modules, function (el) { hsSearch(el); });
    });
  }