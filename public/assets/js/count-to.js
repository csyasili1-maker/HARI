(function($) {
    $.fn.numberAnimate = function(options) {
        const settings = $.extend({
            duration: 2000
        }, options);

        function isInViewport(el) {
            const rect = el.getBoundingClientRect();
            return rect.top < window.innerHeight && rect.bottom > 0;
        }

        function animateNumbers($el) {
            const originalText = $el.text();
            const matches = [...originalText.matchAll(/(\d+(\.\d+)?)/g)];
            if (!matches.length) return;

            let replacedHTML = originalText;
            matches.forEach((match, index) => {
                const decimals = match[2] ? match[2].substring(1).length : 0;
                replacedHTML = replacedHTML.replace(match[0],
                    `<span class="js-counter-num" data-target="${match[0]}" data-decimals="${decimals}" data-index="${index}">0</span>`);
            });

            $el.html(replacedHTML);

            $el.find('.js-counter-num').each(function() {
                const $num = $(this);
                const target = parseFloat($num.data('target'));
                const decimals = parseInt($num.data('decimals'));
                const startTime = performance.now();

                function update(timestamp) {
                    const progress = Math.min((timestamp - startTime) / settings.duration, 1);
                    const value = (target * progress).toFixed(decimals);
                    $num.text(value);
                    if (progress < 1) {
                        requestAnimationFrame(update);
                    }
                }

                requestAnimationFrame(update);
            });
        }

        return this.each(function() {
            const $el = $(this);
            let animated = false;

            function checkAndAnimate() {
                if (!animated && isInViewport(this)) {
                    animateNumbers($el);
                    animated = true;
                    $(window).off('scroll resize', checkAndAnimate);
                }
            }

            checkAndAnimate = checkAndAnimate.bind(this);
            $(window).on('scroll resize', checkAndAnimate);
            checkAndAnimate();
        });
    };
})(jQuery);