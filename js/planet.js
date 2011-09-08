$(function () {
  var system = new System();
});

function System() {

  var self = this;

  this.init_ships = 16;

  // wait time between redraws
  this.interval = 25

  this.stars = [];
  this.ship = [];
  this.missiles = [];

  // size of canvas in pixels
  this.win_w = false;
  this.win_h = false;

  this.w = false;
  this.h = false;

  // raphael canvas
  this.canvas = false;
  this.proxy = false;

  this.fighting = true;

  this.fxs = [];

  self.resize = function( space ) {

    // max viewport area in pixel
    self.win_h = $(window).height();
    self.win_w = $(window).width();

    var offset_x = 0
    var offset_y = 0
    
    self.px_per_ly = (1 / self.zoom);

    self.inset_x = 8;
    self.inset_y = 8;

    self.w = self.win_w - self.inset_x - self.inset_x - 16;
    self.h = self.win_h - self.inset_y - self.inset_y - 16;

    $('#fx').html('');
    $('#fx').css({'width':self.w, 'height': self.h, 'left':self.inset_x, 'top':self.inset_y});
    self.fx = Raphael( 'fx', self.w, self.h );

    $('#view').html('');
    $('#view').css({'width':self.w, 'height': self.h, 'left':self.inset_x, 'top':self.inset_y});
    self.canvas = Raphael( 'view', self.w, self.h );

  }


  this.update = function() {
    
    for ( var i in self.missiles ) {

      var missile = self.missiles[i];

      if ( missile.target ) {
        if ( self.ships[missile.target] != undefined ) {
          var other = self.ships[missile.target];
          var a = G.angle ( other.x, other.y, missile.x, missile.y );
          var t = missile.v;
	      missile.x = missile.x + t * Math.cos(a);
	      missile.y = missile.y + t * Math.sin(a);
          
          var r = G.distance ( other.x, other.y, missile.x, missile.y );
          if ( r < 5 ) {
            self.missiles.splice(i, 1);
            self.fx.circle(other.x, other.y, 20)
              .attr({'fill':'#fff','stroke': false})
              .animate({opacity: 0}, 250, '>', function () {
                this.remove();
              });
          }
        }
      } else {
	    missile.x = missile.x + missile.v * Math.cos(missile.theta);
	    missile.y = missile.y + missile.v * Math.sin(missile.theta);
      }

      missile.ttl = missile.ttl - 1;

      if ( missile.ttl == 0 ) {
        self.missiles.splice(i, 1);
      }

    }

    for ( var i in self.ships ) {
      self.ships[i].hit = false;
      self.ships[i].laser = false;
    }

    for ( var i in self.ships ) {
      var ship = self.ships[i];

      ship.energy = ship.energy + ( ship.recharge * ( 1 - ( 1 / ship.energy_max ) * ship.damage ) );
      if ( ship.energy > ship.energy_max ) {
        ship.energy = ship.energy_max;
      }

      ship.damage = ship.damage - ship.recharge;
      if ( ship.damage < 0 ) {
        ship.damage = 0;
      }

      if ( ship.damage > ship.energy_max  ) {
        self.fx.circle(ship.x, ship.y, ship.energy_max)
          .attr({'fill':'#fff','stroke':ship.lasercolor,'stroke-width': ship.energy_max / 4})
          .animate({r: ship.energy_max, opacity: 0}, 750, '>', function () {
            this.remove();
          });
        self.ships.splice(i, 1);
        continue;
      }

      for ( var j in self.stars ) {
        {

          var star = self.stars[j];

          // angle betweek ship and star
          var theta = G.angle ( star.x, star.y, ship.x, ship.y );
          // distance to star
          var r = G.distance ( ship.x, ship.y, star.x, star.y );

          // gravity
          
          // calc gravity vector
          var g = 10 * ( 100 / ( r*r ) )

          if ( g > 100 ) {
            g = 100;
          }

          // force of gravity on ship
          ship.fg = g;

          // convert gravity to xy. apply
	      gx = g * Math.cos(theta);
	      gy = g * Math.sin(theta);

	      ship.vx = ship.vx + gx;
	      ship.vy = ship.vy + gy;
          
          //thrust ship at 90 deg to star

          var angle = de_ra ( ra_de (theta) + 90 ); 
          var thrust = ship.fg;
	      ship.vx = ship.vx + thrust * Math.cos(angle);
	      ship.vy = ship.vy + thrust * Math.sin(angle);
          
        }
      }


      // damping
      ship.vx = ship.vx * 0.92;
      ship.vy = ship.vy * 0.92;

      ship.x = ship.x + ship.vx;
      ship.y = ship.y + ship.vy;

      if ( ship.x < 0 ) {
        ship.x = 0;
	    ship.vx = - ship.vx * 0.5;
      }

      if ( ship.x > self.w ) {
        ship.x = self.w;
	    ship.vx = - ship.vx * 0.5;
      }

      if ( ship.y < 0 ) {
        ship.y = 0;
	    ship.vy = - ship.vy * 0.5;
      }

      if ( ship.y > self.h ) {
        ship.y = self.h;
	    ship.vy = - ship.vy * 0.5;
      }

      ship.y = ship.y + ship.vy;

      // angle ship is facing
      ship.a = ra_de ( G.angle ( 0, 0, ship.vx, ship.vy ) ) - 90;

      ship.energypc = ( 100 / ship.energy_max ) * ship.energy;
      ship.energyf = ( 1 / ship.energy_max ) * ship.energy;
      self.ships[i].theta = theta;

      // check opponent ships in vicinity

      // flocking to / away from opponents and friendlies
      if ( self.fighting ) {
        var a = 0, t = 0, c = 0;
        for ( var ii in self.ships ) {
          var other = self.ships[ii];
          var theta = G.angle ( star.x, star.y, ship.x, ship.y );
          var range = G.distance ( ship.x, ship.y, star.x, star.y );

          c ++;
          if ( other.power > ship.power ) {
            a = a + de_ra ( ra_de (theta) + 180 ); 
          } else {
            a = a + de_ra ( ra_de (theta) ); 
          }
          t = t + 0.1;
        }

        a = a / c;
        a = a % 360;
        t = ship.impulse / 10;
	    ship.vx = ship.vx + t * Math.cos(a);
	    ship.vy = ship.vy + t * Math.sin(a);

      }

      // combat mode?
      if ( self.fighting ) {

        if ( ship.energy > 20 ) {
          for ( var ii in self.ships ) {
            var other = self.ships[ii];

            if ( other.hue != ship.hue && random1to(1500) == 1 ) {
              self.missiles.push(Missile({x:ship.x, y: ship.y, color: other.lasercolor, target: ii}));
            }

            if ( other.hue != ship.hue && ship.energy > 20 ) {
              var rng = G.distance ( ship.x, ship.y, other.x, other.y );

              if ( rng < ( ship.range * ship.energyf ) ) {
                ship.energy = ship.energy - 1;
                ship.laser = true;

                var f = ( random1to(2) == 1 ) ? -1 : 1;
                ship.laserx = other.x + ( f * random1to( 20 - ship.accuracy ) );
                ship.lasery = other.y + ( f * random1to( 20 - ship.accuracy ) );
                if ( G.distance ( ship.x, ship.y, other.x, other.y ) < 20 ) {
                  other.hit = true;
                  other.energy = other.energy - rng/5;
                  other.recharge = other.recharge - rng/50;
                  if ( other.recharge < 0 ) {
                    other.recharge = 0;
                  }
                  other.damage = other.damage + rng/5;
                }
              }
            }
          }
        }

      }

    }

  }

  this.draw = function() {

    if ( ! self.canvas ) { 
      self.canvas = Raphael( 'view', self.win_w, self.win_h );
    } else {
      self.canvas.clear();
    }

    self.canvas.text( 24, 8, '@psi6030' ).attr({'fill': '#fff', 'opacity':0.5});

    for ( var i in self.stars ) {
      var star = self.stars[i]
      var r = 15;
      star.g = self.canvas
        .circle(star.x, star.y, star.r)
        .attr({'fill':'r(0.25, 0.75)#369-#036'});
    }

    var op = 1 - ( ( 1 / self.init_ships) * self.ships.length );

    // ships
    for ( var i in self.ships ) {
      var ship = self.ships[i]

      var fill = ( ship.hit ) ? '#fff' : false;
      ship.grange = self.canvas.circle(ship.x, ship.y, ( ship.range * ship.energyf / 4 ) )
        .attr({'fill': fill, "stroke-width": ship.power, "stroke":ship.lasercolor, 'opacity': 0.2});

      var r = 6 + ship.fg;
      ship.g = self.canvas
        .path("M".concat( ship.x, ",", ship.y, "m0-", r * .58, "l", r * .5, ",", r * 1.87, "-", r, ",0z"))
        .attr({'stroke':ship.lasercolor, 'fill':'#fff'})
        .rotate(ship.a);

      //self.canvas.text( ship.x + 10, ship.y + 10, ship.fg.toFixed(4) ).attr({'fill': '#fff', 'opacity':0.5});


      if ( ship.laser ) {
        var op = ( ship.energyf * 0.75 ) + 0.25;
        self.canvas.path('M'+ship.x+' '+ship.y+'L'+ship.laserx+' '+ship.lasery)
          .attr({"stroke-width": ship.power, "stroke":ship.lasercolor, 'stroke-linecap':'round', 'opacity': op})
          .animate({opacity: 0}, self.interval);;
      }

      // var s = [Math.round(ship.x,2), Math.round(ship.x,2), 'a: ', Math.round(ship.a,0) , Math.round(ship.vx,2), Math.round(ship.vy,2),, ' g ', ship.fg.toFixed(3)].join('   ');
      // self.canvas.text( ship.x, ship.y, s ).attr({'fill':"#090"});
    }

    for ( var i in self.missiles ) {
      var missile = self.missiles[i]
      missile.g = self.canvas
        .circle(missile.x, missile.y, 1)
        .attr({'stroke':missile.color,'fill':missile.color});
    }


  };

  this.init = function () {
    self.resize();
    self.stars = [];

    self.stars.push ({
      x: (self.w/4)+(random1to(self.w)/2),
      y: (self.h/4)+(random1to(self.h)/2),
      r: 10 + random1to(20),
      mass: 50 + random1to(50)
    });

    if (random1to(2) == 1 ) {
      self.stars.push ({
        x: (self.w/4)+(random1to(self.w)/2),
        y: (self.h/4)+(random1to(self.h)/2),
        r: 10 + random1to(20),
        mass: 50 + random1to(50)
      });
    }

    if (random1to(3) == 1 ) {
      self.stars.push ({
        x: (self.w/4)+(random1to(self.w)/2),
        y: (self.h/4)+(random1to(self.h)/2),
        r: 10 + random1to(20),
        mass: 50 + random1to(50)
      });
    }

    self.ships = [];
    self.init_ships = random1to(30) + 5;
    for ( var i = 0; i < self.init_ships; i ++ ) {
      self.ships.push ( Ship({x_max:self.w, y_max:self.h}) );
    }

    self.missiles = [];

  }

  this.run = function () {
    self.update();
    self.draw();
    setTimeout ( self.run, self.interval );
  };

  this.init();
  this.run();
  setInterval ( self.init, 25000 );

  var resizeTimer = null;

  $(window).bind('resize', function() {
    if (resizeTimer) {
      clearTimeout(self.resizeTimer);
    }
    self.resizeTimer = setTimeout( self.resize, 100);
  });

}


var G = {
  angle: function  ( x1, y1, x2, y2 ) {
    var x = x1 - x2;
    var y = y1 - y2;
    return Math.atan2(y,x);
  },
  distance: function ( x1, y1, x2, y2 ) {
    var x = Math.abs(x1-x2);
    var y = Math.abs(y1-y2);
    return Math.sqrt( (x*x) + (y*y) );
  },
}


function Missile (opts) {
  var opts = opts || {};
  return {
    x: opts.x || 0,
    y: opts.y || 0,
    target: opts.target || false,
    color: opts.color || '#fff',
    theta: opts.theta || random1to (360)-1,
    v: opts.v || 10 + random1to(10)/20,
    ttl : 25 + random1to(15)
  }
}

function Ship (opts) {

  var x = ( opts.x_max / 2 ) + ( opts.x_max / 4 ) - random1to(opts.x_max / 2 );
  var y = ( opts.y_max / 2 ) + ( opts.y_max / 4 ) - random1to(opts.y_max / 2 );

  var vx = ( 4 - random1to(8) ) * 0.5
  var vy = ( 4 - random1to(8) ) * 0.5;

  var a = random1to(360);
  var v = random1to(10);

  var hue = random1to(4) - 1
  var lum = random1to(8)

  if ( hue == 0 ) {
    // blue
    var hex = dec2hex ( lum ).substring(1);
    var color = '#00f';
  }
  if ( hue == 1 ) {
    // red
    var hex = dec2hex ( 8 + ( lum / 2 ) ).substring(1);
    var color = '#f00';
  }
  if ( hue == 2 ) {
    // yellow
    var hex = dec2hex ( lum ).substring(1);
    var color = '#ff0';
  }
  if ( hue == 3 ) {
    // green
    var hex = dec2hex ( 9 + ( lum / 4 ) ).substring(1);
    var color = '#0f0';
  }

  var energy_max = 20 + random1to(10);
  var impulse = random1to(10);
  
  var ship = {
    x: x,
    y: y,
    vx:vx,
    vy:vy,
    a: a,
    hue: hue,
    energy_max: energy_max,
    damage: 0,
    energy: 0,
    recharge: 1 + ( random1to(10) ) / 10,
    range: 50 + random1to(50),
    accuracy: random1to(10),
    power: random1to(4),
    impulse: impulse,
    lasercolor: color,
    v: v
  };
  return ship;

}

function ra_de(r) {
  return r*(180/Math.PI);
}

function de_ra(d) {
  var pi = Math.PI;
  return (d)*(pi/180);
}

function random0to (max) {
  return Math.floor( Math.random() * max );
}

function random1to (max) {
  return 1 + Math.floor( Math.random() * max );
}

function dec2hex(d, padding) {
  var hex = Number(d).toString(16);
  padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

  while (hex.length < padding) {
    hex = "0" + hex;
  }

  return hex;
}
