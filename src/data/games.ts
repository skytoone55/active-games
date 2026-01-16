export interface Game {
  id: string
  name: string
  image: string
  video: string
  popupImage: string
}

export const games: Game[] = [
  {
    id: 'grid',
    name: 'Grid',
    image: '/images/games/grid-thumb.jpg',
    video: '/videos/grid.mp4',
    popupImage: '/images/games/grid-popup.jpg',
  },
  {
    id: 'arena',
    name: 'Arena',
    image: '/images/games/arena-thumb.jpg',
    video: '/videos/arena.mp4',
    popupImage: '/images/games/arena-popup.jpg',
  },
  {
    id: 'push',
    name: 'Push',
    image: '/images/games/push-thumb.jpg',
    video: '/videos/push.mp4',
    popupImage: '/images/games/push-popup.jpg',
  },
  {
    id: 'basketball',
    name: 'Hoops Basketball',
    image: '/images/games/basketball-thumb.jpg',
    video: '/videos/basketball.mp4',
    popupImage: '/images/games/basketball-popup.jpg',
  },
  {
    id: 'climbing',
    name: 'Climbing',
    image: '/images/games/climbing-thumb.jpg',
    video: '/videos/climbing.mp4',
    popupImage: '/images/games/climbing-popup.jpg',
  },
  {
    id: 'hide',
    name: 'Hide Game Room',
    image: '/images/games/hide-thumb.jpg',
    video: '/videos/hide.mp4',
    popupImage: '/images/games/hide-popup.jpg',
  },
  {
    id: 'flash',
    name: 'Flash',
    image: '/images/games/flash-thumb.jpg',
    video: '/videos/flash.mp4',
    popupImage: '/images/games/flash-popup.jpg',
  },
  {
    id: 'laser',
    name: 'Laser',
    image: '/images/games/laser-thumb.jpg',
    video: '/videos/laser.mp4',
    popupImage: '/images/games/laser-popup.jpg',
  },
  {
    id: 'control',
    name: 'Control',
    image: '/images/games/control-thumb.jpg',
    video: '/videos/control.mp4',
    popupImage: '/images/games/control-popup.jpg',
  },
]

// Assets locaux (téléchargés)
export const localAssets = {
  logo: '/images/logo.png',
  contactImage: '/images/contact-image.png',
  games: {
    grid: {
      thumb: '/images/games/grid-thumb.jpg',
      video: '/videos/grid.mp4',
      popup: '/images/games/grid-popup.jpg',
    },
    arena: {
      thumb: '/images/games/arena-thumb.jpg',
      video: '/videos/arena.mp4',
      popup: '/images/games/arena-popup.jpg',
    },
    push: {
      thumb: '/images/games/push-thumb.jpg',
      video: '/videos/push.mp4',
      popup: '/images/games/push-popup.jpg',
    },
    basketball: {
      thumb: '/images/games/basketball-thumb.jpg',
      video: '/videos/basketball.mp4',
      popup: '/images/games/basketball-popup.jpg',
    },
    climbing: {
      thumb: '/images/games/climbing-thumb.jpg',
      video: '/videos/climbing.mp4',
      popup: '/images/games/climbing-popup.jpg',
    },
    hide: {
      thumb: '/images/games/hide-thumb.png',
      video: '/videos/hide.mp4',
      popup: '/images/games/hide-popup.jpg',
    },
    flash: {
      thumb: '/images/games/flash-thumb.jpg',
      video: '/videos/flash.mp4',
      popup: '/images/games/flash-popup.jpg',
    },
    laser: {
      thumb: '/images/games/laser-thumb.jpg',
      video: '/videos/laser.mp4',
      popup: '/images/games/laser-popup.jpg',
    },
    control: {
      thumb: '/images/games/control-thumb.png',
      video: '/videos/control.mp4',
      popup: '/images/games/control-popup.png',
    },
  },
}

// URLs originales pour téléchargement (référence)
export const originalAssets = {
  logo: 'https://activegamesworld.com/wp-content/uploads/2025/11/Logo-1.png',
  contactImage: 'https://activegamesworld.com/wp-content/uploads/2025/11/F7A9E442-7C30-4276-B3B5-225CDBF39A72-1024x683.png',
  games: {
    grid: {
      thumb: '/images/games/grid-thumb.jpg',
      video: '/videos/grid.mp4',
      popup: '/images/games/grid-popup.jpg',
    },
    arena: {
      thumb: '/images/games/arena-thumb.jpg',
      video: '/videos/arena.mp4',
      popup: '/images/games/arena-popup.jpg',
    },
    push: {
      thumb: '/images/games/push-thumb.jpg',
      video: '/videos/push.mp4',
      popup: '/images/games/push-popup.jpg',
    },
    basketball: {
      thumb: '/images/games/basketball-thumb.jpg',
      video: '/videos/basketball.mp4',
      popup: '/images/games/basketball-popup.jpg',
    },
    climbing: {
      thumb: '/images/games/climbing-thumb.jpg',
      video: '/videos/climbing.mp4',
      popup: '/images/games/climbing-popup.jpg',
    },
    hide: {
      thumb: '/images/games/hide-thumb.png',
      video: '/videos/hide.mp4',
      popup: '/images/games/hide-popup.jpg',
    },
    flash: {
      thumb: '/images/games/flash-thumb.jpg',
      video: '/videos/flash.mp4',
      popup: '/images/games/flash-popup.jpg',
    },
    laser: {
      thumb: '/images/games/laser-thumb.jpg',
      video: '/videos/laser.mp4',
      popup: '/images/games/laser-popup.jpg',
    },
    control: {
      thumb: '/images/games/control-thumb.png',
      video: '/videos/control.mp4',
      popup: '/images/games/control-popup.png',
    },
  },
}
