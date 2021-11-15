const forwarderOrigin = 'http://localhost:9010'

const contractpaths = [
  "./../build/contracts/AssetsAccountant.json",
  "./../build/contracts/HouseOfCoin.json",
  "./../build/contracts/HouseOfReserve.json",
  "./../build/contracts/MockOracle.json",
  "./../build/contracts/DigitalFiat.json",
  "./../build/contracts/MockWETH.json"
]

const getLastMigration = (artifact) => {
  let networks = artifact.networks;
  let timestamps = Object.keys(networks);
  let lastItem = timestamps.length - 1;
  return networks[timestamps[lastItem]];
}

const loadContracts = async (paths, signer) => {
  let contractCollector = new Array(paths.length);
  for (let i = 0; i < paths.length; i++) {
      let json = await $.getJSON(paths[i]);
      let abi = json.abi;
      let lastMigration = getLastMigration(json);
      contractCollector[i] = new ethers.Contract(
              lastMigration.address,
              abi,
              signer
      )
  }
  return contractCollector;
}


const initialize = async() => {

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();

  let accounts;

  let accountant;
  let coinhouse;
  let reservehouse;
  let mockoracle;
  let efiat;
  let mockweth;

  const loader = async () => {
    [
      accountant,
      coinhouse,
      reservehouse,
      mockoracle,
      efiat,
      mockweth
    ] = await loadContracts(contractpaths, signer);
  }

  await loader();

  //Basic Actions Section

  // Buttons
  const onboardButton = document.getElementById('connectButton');
  const depositButton = document.getElementById('depositButton');
  const withdrawButton = document.getElementById('withdrawButton');
  const mintButton = document.getElementById('mintButton');
  const paybackButton = document.getElementById('paybackButton');

  // Inputs
  const wethDepositInput = document.getElementById('wethDepositInput');
  const wethWithdrawInput = document.getElementById('wethWithdrawInput');
  const efiatMintInput = document.getElementById('efiatMintInput');
  const reserveAddrToUse = document.getElementById('reserveAddrToUse');
  const efiatPaybackInput = document.getElementById('efiatPaybackInput');

  // Labels
  const getAccountsResult = document.getElementById('getAccountsResult');
  const getAccountBalance = document.getElementById('getAccountBalance');
  const mockwethAddr = document.getElementById('mockwethAddr');
  const getWETHBalance = document.getElementById('getWETHBalance');
  const yourReserves = document.getElementById('yourReserves');
  const lockedReserves = document.getElementById('lockedReserves');
  const getEFIATBalance = document.getElementById('getEFIATBalance');
  const yourMinted = document.getElementById('yourMinted');

  //Created check function to see if the MetaMask extension is installed
  const isMetaMaskInstalled = () => {
    //Have to check the ethereum binding on the window object to see if it's installed
    const { ethereum } = window;
    return Boolean(ethereum && ethereum.isMetaMask);
  };

  const MetaMaskClientCheck = () => {
    //Now we check to see if MetaMask is installed
    if (!isMetaMaskInstalled()) {
      //If it isn't installed we ask the user to click to install it
      onboardButton.innerText = 'Click here to install MetaMask!';
      //When the button is clicked we call this function
      onboardButton.onclick = onClickInstall;
      //The button is now disabled
      onboardButton.disabled = false;
    } else {
      //If it is installed we change our button text
      onboardButton.innerText = 'Connect';
      //When the button is clicked we call this function to connect the users MetaMask Wallet
      onboardButton.onclick = onClickConnect;
      //The button is now disabled
      onboardButton.disabled = false;
    }
  };

  //We create a new MetaMask onboarding object to use in our app
  const onboarding = new MetaMaskOnboarding({ forwarderOrigin });

  //This will start the onboarding proccess
  const onClickInstall = () => {
    onboardButton.innerText = 'Onboarding in progress';
    onboardButton.disabled = true;
    //On this object we have startOnboarding which will start the onboarding process for our end user
    onboarding.startOnboarding();
  };

  // Will connect to metamask
  const onClickConnect = async () => {
    try {
      // Will open the MetaMask UI
      // You should disable this button while the request is pending!
      let balance = await provider.getBalance(accounts[0]);
      balance = balance/1e18;
      getAccountsResult.innerHTML = accounts[0] || 'Not able to get accounts';
      getAccountBalance.innerHTML = balance.toFixed(4) || 'N/A';

      loadMockWETHBalance();
      loadDepositedReservesBalance();
      loadEFIATBalance();
      loadMintedEFIATBalance();
    } catch (error) {
      console.error(error);
    }
  };

  const loadMockWETHBalance = async () => {
    let mockWETHbal = await mockweth.balanceOf(accounts[0]);
    mockWETHbal = mockWETHbal/1e18;
    mockwethAddr.innerHTML = mockweth.address;
    getWETHBalance.innerHTML = mockWETHbal.toFixed(4);
  }

  const loadDepositedReservesBalance = async () => {
    let tokenID = await reservehouse.reserveTokenID();
    let reserveBal = await accountant.balanceOf(accounts[0],tokenID);
    reserveBal = reserveBal/1e18;
    yourReserves.innerHTML = reserveBal.toFixed(4);
  }

  const loadEFIATBalance = async () => {
    let efiatBal = await efiat.balanceOf(accounts[0]);
    efiatBal = efiatBal/1e18;
    getEFIATBalance.innerHTML = efiatBal.toFixed(2);
  }

  const loadMintedEFIATBalance = async () => {
    let tokenID = await reservehouse.backedTokenID();
    let mintedBal = await accountant.balanceOf(accounts[0],tokenID);
    mintedBal = mintedBal/1e18;
    yourMinted.innerHTML = mintedBal.toFixed(2);
  }

  const approveDeposit = async () => {
    // Check and read Inputvalue
    let inputVal = document.getElementById("wethDepositInput").value;
    let mockWETHbal = await mockweth.balanceOf(accounts[0]);
    if(!inputVal) {
      alert("enter deposit amount value!");
    } else {
      let approvaltx = await mockweth.approve(
        reservehouse.address,
        inputVal
      );
      console.log('approval TxHash', approvaltx);
      await executeDeposit(inputVal);
    }
  }

  const executeDeposit = async (amount) => {
    let depositTx = await reservehouse.deposit(amount);
    console.log('deposit TxHash', depositTx);
    onboardButton.innerText = 'Refresh';
  }

  const withdrawReserve = async () => {
    // Check and read Inputvalue
    let inputVal = document.getElementById("wethWithdrawInput").value;
    let tokenID = await reservehouse.reserveTokenID();
    let reserveBal = await accountant.balanceOf(accounts[0],tokenID);
    let inputValBN = ethers.BigNumber.from(inputVal);

    if (!inputValBN) {
      alert("enter withdraw amount value!");
    } else if (inputValBN.gt(reserveBal)) {
      alert("cannot withdraw more that reserves!");
    } else {
      let withdrawTx = await reservehouse.withdraw(inputValBN);
      console.log('withdraw TxHash', withdrawTx);
      onClickConnect();
    }    
  }

  const userInteraction = async () => {
    depositButton.onclick = approveDeposit;
    withdrawButton.onclick = withdrawReserve;
  }

  /// Application running
  await MetaMaskClientCheck();
  accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  userInteraction();
  
}

window.addEventListener('DOMContentLoaded', initialize);
// ethereum.on('accountsChanged', initialize);

// const refresher = async () => {

//   const provider = new ethers.providers.Web3Provider(window.ethereum);
//   const signer = provider.getSigner();

//   let accounts;

//   let accountant;
//   let coinhouse;
//   let reservehouse;
//   let mockoracle;
//   let efiat;
//   let mockweth;

//   const loader = async () => {
//     [
//       accountant,
//       coinhouse,
//       reservehouse,
//       mockoracle,
//       efiat,
//       mockweth
//     ] = await loadContracts(contractpaths, signer);
//   }

//   await loader();

//   const loadMockWETHBalance = async () => {
//     let mockWETHbal = await mockweth.balanceOf(accounts[0]);
//     mockWETHbal = mockWETHbal/1e18;
//     mockwethAddr.innerHTML = mockweth.address;
//     getWETHBalance.innerHTML = mockWETHbal.toFixed(4);
//   }

//   const loadDepositedReservesBalance = async () => {
//     let tokenID = await reservehouse.reserveTokenID();
//     let reserveBal = await accountant.balanceOf(accounts[0],tokenID);
//     reserveBal = reserveBal/1e18;
//     yourReserves.innerHTML = reserveBal.toFixed(4);
//   }

//   const loadEFIATBalance = async () => {
//     let efiatBal = await efiat.balanceOf(accounts[0]);
//     efiatBal = efiatBal/1e18;
//     getEFIATBalance.innerHTML = efiatBal.toFixed(2);
//   }

//   const loadMintedEFIATBalance = async () => {
//     let tokenID = await reservehouse.backedTokenID();
//     let mintedBal = await accountant.balanceOf(accounts[0],tokenID);
//     mintedBal = mintedBal/1e18;
//     yourMinted.innerHTML = mintedBal.toFixed(2);
//   }

//   const updateAllLabels = async () => {
//     let balance = await provider.getBalance(accounts[0]);
//     balance = balance/1e18;
//     getAccountsResult.innerHTML = accounts[0] || 'Not able to get accounts';
//     getAccountBalance.innerHTML = balance.toFixed(4) || 'N/A';
//     loadMockWETHBalance();
//     loadDepositedReservesBalance();
//     loadEFIATBalance();
//     loadMintedEFIATBalance();
//   }

//   updateAllLabels();

// }

// setInterval(refresher, 10000);
