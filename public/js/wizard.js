$(function() {
	function delay(time) {
		return new Promise(resolve => {
			window.setTimeout(() => {
				resolve();
			}, time);
		});
	}

	function dotrans() {
		var tl = gsap.timeline();
		tl.to(".float-up", { duration: 0.3, opacity: 0, x: -100, stagger: 0.05 });
		tl.to(".loader li", { transformOrigin: "bottom left", duration: 0.5, scaleY: 1, stagger: 0.1 });
		tl.to(".loader li", { transformOrigin: "top left", duration: 0.3, scaleY: 0, stagger: 0.1 });
	}

	function floatIn() {
		var tl = gsap.timeline();
		tl.set(".float-up", { opacity: 0, y: 30 });
		tl.to(".float-up", { duration: 0.5, opacity: 1, y: 0, stagger: 0.2 });
	}

	barba.init({
		sync: true,
		transitions: [
			{
				async leave(data) {
					const done = this.async();
					dotrans();
					await delay(3000);
					done();
				},
				async enter(data) {
					floatIn();
				},
				async once(data) {
					floatIn();
				}
			}
		],
		prevent: ({ el }) => el.classList && el.classList.contains("prevent")
	});
});
